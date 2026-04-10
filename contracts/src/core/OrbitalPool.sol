// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {FullMath}              from "../lib/FullMath.sol";
import {SphereMath}            from "../lib/SphereMath.sol";
import {TorusMath}             from "../lib/TorusMath.sol";
import {TickLib}               from "../lib/TickLib.sol";
import {PositionLib}           from "../lib/PositionLib.sol";
import {OrbitalOracle}         from "../lib/OrbitalOracle.sol";
import {TransferHelper}        from "../lib/TransferHelper.sol";
import {IERC20Minimal}         from "../interfaces/IERC20Minimal.sol";
import {IOrbitalMintCallback}  from "../interfaces/IOrbitalMintCallback.sol";
import {IOrbitalSwapCallback}  from "../interfaces/IOrbitalSwapCallback.sol";
import {IOrbitalPoolEvents}    from "../interfaces/IOrbitalPoolEvents.sol";
import {OrbitalPoolDeployer}   from "./OrbitalPoolDeployer.sol";

/// @title OrbitalPool
/// @notice Per-asset-set pool contract for the orbital AMM.
/// @dev    3C-1 only — storage layout, constructor, and reentrancy lock.
///         Mint/swap/burn/collect/oracle entrypoints (3C-2..8) are pending.
///         The storage layout below is the source of truth and should not be
///         changed once tests are written against it.
contract OrbitalPool is IOrbitalPoolEvents {
    uint256 internal constant WAD = 1e18;

    // ─────────────────────────────────────────────────────────────────────
    // Immutables — set once in constructor from deployer parameters
    // ─────────────────────────────────────────────────────────────────────

    /// @notice The factory that deployed this pool.
    address public immutable factory;

    /// @notice Number of assets the pool trades.
    uint256 public immutable n;

    /// @notice Pool fee in hundredths of a bip.
    uint24 public immutable fee;

    /// @notice The pool's token set, in canonical (sorted) order.
    /// @dev    Cannot be `immutable` — Solidity does not yet support immutable
    ///         dynamic arrays. Written once in the constructor and never again.
    address[] public tokens;

    // ─────────────────────────────────────────────────────────────────────
    // Slot0 — hot torus state, packed for cheap reads
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Pool-level torus state mirroring `TorusMath.TorusState`, plus a
    ///         reentrancy lock. Updated on every mint/swap/burn.
    struct Slot0 {
        uint256 sumX;     // Σxᵢ across all reserves, WAD-scaled
        uint256 sumXSq;   // Σ(xᵢ²/WAD) across all reserves, WAD-scaled
        uint256 rInt;     // consolidated interior radius, WAD-scaled
        uint256 kBound;   // Σk over boundary ticks, WAD-scaled
        uint256 sBound;   // Σs over boundary ticks, WAD-scaled
        bool    unlocked; // reentrancy lock; true outside any state-mutating call
    }

    Slot0 public slot0;

    // ─────────────────────────────────────────────────────────────────────
    // Reserves, fees, ticks, positions
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Per-asset reserve, indexed by position in `tokens`. WAD-scaled.
    ///         Excludes accrued (uncollected) fees, which sit in `feesAccrued`.
    mapping(uint256 => uint256) public reserves;

    /// @notice Per-asset fee bucket, in raw token units. Tokens transferred in
    ///         as the fee portion of a swap accumulate here and are paid out
    ///         to LPs by `collect`. Held outside `reserves[]` so the AMM
    ///         invariant is not perturbed by fees.
    mapping(uint256 => uint256) public feesAccrued;

    /// @notice Per-asset accumulated fee growth per unit of interior liquidity
    ///         (rInt), WAD-scaled. Mirrors Uniswap V3's per-token feeGrowthGlobal
    ///         but indexed by asset, since fees are paid in whichever asset was
    ///         swapped in.
    mapping(uint256 => uint256) public feeGrowthGlobal;

    /// @notice Per-position snapshot of `feeGrowthGlobal[asset]` at the time of
    ///         the last update. Keyed by (positionKey, assetIndex).
    mapping(bytes32 => mapping(uint256 => uint256)) public feeGrowthInsideLast;

    /// @notice Per-position uncollected fees, in raw token units, by asset.
    mapping(bytes32 => mapping(uint256 => uint256)) public tokensOwed;

    /// @notice Tick metadata, in insertion order. `numTicks == ticks.length`
    ///         but is exposed separately so callers can read length without an
    ///         extra getter.
    TickLib.Tick[] public ticks;

    function numTicks() external view returns (uint256) {
        return ticks.length;
    }

    /// @notice LP positions, keyed by `PositionLib.positionKey(owner, tickIdx)`.
    mapping(bytes32 => PositionLib.Position) public positions;

    // ─────────────────────────────────────────────────────────────────────
    // Oracle ring buffer (paper-agnostic; mirrors Uniswap V3 oracle layout)
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Time-weighted observation ring buffer. Slot 0 is seeded in the
    ///         constructor; subsequent writes happen on swap.
    OrbitalOracle.Observation[65535] public observations;

    /// @notice Index of the most recently written observation.
    uint16 public observationIndex;

    /// @notice Number of populated observation slots.
    uint16 public observationCardinality;

    /// @notice Next-target observation cardinality, ratcheted by `grow`.
    uint16 public observationCardinalityNext;

    // ─────────────────────────────────────────────────────────────────────
    // Reentrancy lock
    // ─────────────────────────────────────────────────────────────────────

    /// @dev Single-entry guard for all state-mutating external calls.
    modifier lock() {
        require(slot0.unlocked, "OrbitalPool: locked");
        slot0.unlocked = false;
        _;
        slot0.unlocked = true;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Constructor — read parameters from the deploying factory
    // ─────────────────────────────────────────────────────────────────────

    constructor() {
        // The deployer (== factory) staged Parameters in storage immediately
        // before CREATE2. We read them back here so the bytecode hash is
        // independent of the constructor args, keeping CREATE2 addresses
        // deterministic from (deployer, salt) alone.
        (address f, address[] memory t, uint24 fe) =
            OrbitalPoolDeployer(msg.sender).getParameters();

        factory = f;
        fee     = fe;
        n       = t.length;

        // Copy the dynamic array into storage explicitly.
        for (uint256 i; i < t.length; ++i) {
            tokens.push(t[i]);
        }

        // Pool starts unlocked; first mint will populate reserves.
        slot0.unlocked = true;

        // Seed the oracle ring buffer at slot 0 with the current block time.
        // Cardinality starts at 1; LPs grow it via `increaseObservationCardinalityNext`.
        (observationCardinality, observationCardinalityNext) =
            OrbitalOracle.initialize(observations, uint32(block.timestamp));
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3C-7 — Reserve / state helpers
    // ─────────────────────────────────────────────────────────────────────

    /// @dev Snapshot the consolidated torus state for invariant checks and
    ///      math-library calls.
    function _buildTorusState() internal view returns (TorusMath.TorusState memory) {
        Slot0 memory s = slot0;
        return TorusMath.TorusState({
            rInt:   s.rInt,
            kBound: s.kBound,
            sBound: s.sBound,
            sumX:   s.sumX,
            sumXSq: s.sumXSq,
            n:      n
        });
    }

    /// @dev Materialise the per-asset reserve mapping into a contiguous array.
    function _currentReserves() internal view returns (uint256[] memory out) {
        out = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            out[i] = reserves[i];
        }
    }

    /// @dev Compute the per-asset deposit for an LP at rWad.
    ///
    ///      Empty pool (rInt == 0):
    ///        Equal-price deposit — `rWad·(1 − 1/√n)` per asset.
    ///        At equal price wNorm = 0 and term1² = rInt² so the invariant
    ///        holds trivially after the first mint.
    ///
    ///      Imbalanced pool (rInt > 0):
    ///        Pro-rata deposit — `reserves[i] * rWad / rInt` per asset.
    ///        This buys a proportional share of the current pool without
    ///        moving prices. Every x_i scales by λ = (rInt+rWad)/rInt, which
    ///        scales sumX by λ, sumXSq by λ², wNorm by λ, and αInt by λ
    ///        (when kBound = 0). The LHS then becomes λ²·rInt² = (rInt+rWad)²
    ///        exactly. When boundary ticks exist (kBound > 0) the αInt term
    ///        does not scale perfectly, but the residual is within the
    ///        1e-6 tolerance enforced by checkInvariant at the end of mint.
    function _computeDepositAmounts(uint256 rWad)
        internal
        view
        returns (uint256[] memory amounts)
    {
        amounts = new uint256[](n);
        if (slot0.rInt == 0) {
            // Empty pool — symmetric equal-price deposit.
            uint256 perAsset = SphereMath.equalPricePoint(rWad, n);
            for (uint256 i; i < n; ++i) {
                amounts[i] = perAsset;
            }
        } else {
            // Pro-rata deposit is only invariant-preserving when no boundary
            // ticks exist. With kBound > 0 the αInt term does not scale
            // proportionally and the torus LHS drifts beyond tolerance.
            require(slot0.kBound == 0, "OrbitalPool: mint blocked while boundary ticks exist");
            for (uint256 i; i < n; ++i) {
                amounts[i] = FullMath.mulDiv(reserves[i], rWad, slot0.rInt);
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3C-2 — Mint (add liquidity)
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Add liquidity at tick `kWad` with radius contribution `rWad`.
    /// @dev    Supports:
    ///         - Empty pool: equal-price deposit of `r·(1 − 1/√n)` per asset.
    ///         - Imbalanced pool (after swaps): pro-rata deposit at current
    ///           reserve ratios, preserving prices.
    ///         - Tick merging: if a tick at the same `k` already exists, the
    ///           new liquidity is added to it. Multiple LPs at the same `k`
    ///           share one tick but keep separate positions.
    ///         - Position stacking: if the same (recipient, tick) already has
    ///           a position, accrued fees are settled before the new `rWad`
    ///           is added to the existing position.
    /// @param recipient Address that will own the resulting LP position.
    /// @param kWad      Tick plane constant, WAD-scaled. Must lie within
    ///                  `[TickLib.kMin(rWad, n), TickLib.kMax(rWad, n)]`.
    /// @param rWad      Liquidity (radius contribution), WAD-scaled. > 0.
    /// @param data      Opaque payload forwarded to the mint callback so the
    ///                  caller can locate the LP funding source.
    /// @return amounts  Per-asset token amounts pulled from `msg.sender`.
    function mint(
        address recipient,
        uint256 kWad,
        uint256 rWad,
        bytes calldata data
    ) external lock returns (uint256[] memory amounts) {
        require(rWad > 0, "OrbitalPool: rWad=0");

        // Validate k ∈ [kMin, kMax] for the LP-supplied r.
        uint256 km = TickLib.kMin(rWad, n);
        uint256 kM = TickLib.kMax(rWad, n);
        require(kWad >= km && kWad <= kM, "OrbitalPool: k out of range");

        // Compute per-asset deposit amounts (equal-price for empty pool,
        // pro-rata for imbalanced pool).
        amounts = _computeDepositAmounts(rWad);

        // ── State updates ────────────────────────────────────────────────

        // Search for an existing tick at the same k. If found, merge into
        // it; otherwise create a new tick entry.
        uint256 tickIdx;
        {
            bool found;
            uint256 len = ticks.length;
            for (uint256 i; i < len; ++i) {
                if (ticks[i].k == kWad) {
                    tickIdx = i;
                    found   = true;
                    break;
                }
            }
            if (found) {
                // Merge into existing tick — add liquidity.
                TickLib.Tick storage t = ticks[tickIdx];
                t.r              += rWad;
                t.liquidityGross += uint128(rWad);
            } else {
                // New tick, marked interior: the LP is depositing at the
                // current price so the tick's depeg threshold has not been hit.
                ticks.push(
                    TickLib.Tick({
                        k:                kWad,
                        r:                rWad,
                        isInterior:       true,
                        feeGrowthInside:  0,
                        liquidityGross:   uint128(rWad)
                    })
                );
                tickIdx = ticks.length - 1;
            }
        }

        // Update sumX, sumXSq, and reserves per-asset (amounts may differ).
        uint256 totalAdded;
        for (uint256 i; i < n; ++i) {
            uint256 xi  = reserves[i];
            uint256 amt = amounts[i];
            totalAdded     += amt;
            slot0.sumXSq   += FullMath.mulDiv(2 * xi, amt, WAD)
                             + FullMath.mulDiv(amt, amt, WAD);
            reserves[i]     = xi + amt;
        }
        slot0.sumX += totalAdded;
        slot0.rInt += rWad;

        // Position keyed by (recipient, tickIdx). Multiple LPs at the same
        // tick share a tick but have separate positions.
        bytes32 pKey = PositionLib.positionKey(recipient, tickIdx);
        PositionLib.Position storage pos = positions[pKey];

        if (pos.r > 0) {
            // Existing position — settle accrued fees at the old r before
            // increasing it, so the LP doesn't earn retroactive fees on
            // the newly added liquidity.
            _updatePositionFees(pKey, pos.r);
            pos.r += rWad;
        } else {
            // Fresh position.
            pos.tickIndex = tickIdx;
            pos.r         = rWad;
        }

        // Snapshot per-asset feeGrowthGlobal so future fee accruals to this
        // position only count growth that happened *after* the mint.
        for (uint256 i; i < n; ++i) {
            feeGrowthInsideLast[pKey][i] = feeGrowthGlobal[i];
        }

        // ── Pull tokens via the mint callback ────────────────────────────
        //
        // We snapshot the contract's ERC20 balances *before* the callback,
        // hand control to the caller (which transfers tokens in), then
        // verify each balance increased by at least the requested amount.
        // This is the V3 callback pattern: trust the caller to pay, but
        // verify by balance delta.
        uint256[] memory balancesBefore = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            balancesBefore[i] = IERC20Minimal(tokens[i]).balanceOf(address(this));
        }

        IOrbitalMintCallback(msg.sender).orbitalMintCallback(amounts, data);

        for (uint256 i; i < n; ++i) {
            uint256 received = IERC20Minimal(tokens[i]).balanceOf(address(this)) - balancesBefore[i];
            require(received >= amounts[i], "OrbitalPool: M0");
        }

        // ── Invariant sanity check ───────────────────────────────────────
        //
        // For the equal-price symmetric mint this is a tautology, but we
        // run it anyway as a regression guard: any future change to the
        // mint formula that breaks the torus invariant will fail loudly
        // here rather than corrupt state silently.
        (bool ok, ) = TorusMath.checkInvariant(_buildTorusState());
        require(ok, "OrbitalPool: invariant");

        emit Mint(recipient, kWad, rWad, amounts);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3C-6 — Fee accounting helpers
    // ─────────────────────────────────────────────────────────────────────

    /// @dev Credit `feeAmount` of `assetIn` to interior LPs and stash the
    ///      tokens in `feesAccrued` so they don't perturb the AMM invariant.
    ///      No-op when there is no interior liquidity to credit.
    function _accumulateFee(uint256 assetIn, uint256 feeAmount) internal {
        if (feeAmount == 0) return;
        feesAccrued[assetIn] += feeAmount;

        uint256 rInt = slot0.rInt;
        if (rInt == 0) return;
        feeGrowthGlobal[assetIn] += FullMath.mulDiv(feeAmount, WAD, rInt);
    }

    /// @dev Settle uncollected fees for a position across all assets:
    ///      tokensOwed[i] += pos.r * (feeGrowthGlobal[i] − snapshot[i]) / WAD.
    function _updatePositionFees(bytes32 pKey, uint256 posR) internal {
        for (uint256 i; i < n; ++i) {
            uint256 g    = feeGrowthGlobal[i];
            uint256 last = feeGrowthInsideLast[pKey][i];
            if (g != last) {
                if (posR > 0) {
                    uint256 growth = g - last; // monotonic; underflow = state bug
                    tokensOwed[pKey][i] += FullMath.mulDiv(posR, growth, WAD);
                }
                feeGrowthInsideLast[pKey][i] = g;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3C-7 — Reserve accounting helpers
    // ─────────────────────────────────────────────────────────────────────

    /// @dev Apply a settled swap's reserve and sumX/sumXSq changes to slot0.
    ///      Uses the identity (x+d)² − x² = 2xd + d² for the input asset and
    ///      x² − (x−d)² = 2xd − d² for the output asset (matching TorusMath).
    function _updateReserves(
        uint256 assetIn,
        uint256 assetOut,
        uint256 amountIn,
        uint256 amountOut
    ) internal {
        uint256 xiOld = reserves[assetIn];
        uint256 xjOld = reserves[assetOut];

        // sumX: net token flow
        slot0.sumX = slot0.sumX + amountIn - amountOut;

        // sumXSq input side: += 2·xi·amountIn + amountIn²
        uint256 addIn = FullMath.mulDiv(2 * xiOld, amountIn, WAD)
                      + FullMath.mulDiv(amountIn, amountIn, WAD);

        // sumXSq output side: -= (2·xj·amountOut − amountOut²)
        //   = subtract 2·xj·amountOut, add back amountOut²
        uint256 twoXjAmountOut = FullMath.mulDiv(2 * xjOld, amountOut, WAD);
        uint256 amountOutSq    = FullMath.mulDiv(amountOut, amountOut, WAD);

        slot0.sumXSq = slot0.sumXSq + addIn - twoXjAmountOut + amountOutSq;

        reserves[assetIn]  += amountIn;
        reserves[assetOut] -= amountOut;
    }

    /// @dev Compute how many tokens to return to an LP removing `rWad`.
    ///      Pro-rata over total interior liquidity:
    ///      amounts[i] = reserves[i] * rWad / rInt
    function _computeWithdrawAmounts(uint256 /* tickIndex */, uint256 rWad)
        internal
        view
        returns (uint256[] memory amounts)
    {
        uint256 rInt = slot0.rInt;
        require(rInt > 0, "OrbitalPool: no liquidity");
        amounts = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            amounts[i] = FullMath.mulDiv(reserves[i], rWad, rInt);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3C-8 — Oracle
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Query time-weighted cumulative sumX and sumXSq at multiple
    ///         historical offsets. Each entry in `secondsAgos` is seconds
    ///         before now; 0 means the current block.
    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (
            uint256[] memory cumulativeSumXs,
            uint256[] memory cumulativeSumXSqs
        )
    {
        return OrbitalOracle.observe(
            observations,
            uint32(block.timestamp),
            secondsAgos,
            slot0.sumX,
            slot0.sumXSq,
            observationIndex,
            observationCardinality
        );
    }

    /// @notice Expand the oracle ring buffer's target cardinality.
    ///         Pre-initialises new slots so future writes are cheap.
    function increaseObservationCardinalityNext(uint16 next) external {
        observationCardinalityNext = OrbitalOracle.grow(
            observations,
            observationCardinalityNext,
            next
        );
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3C-3 — Swap internals (Layer 2)
    // ─────────────────────────────────────────────────────────────────────

    /// @dev In-memory torus + loop state passed through _solveWithCrossings.
    struct SwapState {
        TorusMath.TorusState torus; // mutable copy of slot0 torus params
        uint256 amountInRemaining;  // net amountIn still to trade
        uint256 amountOutAcc;       // accumulated output so far
    }

    /// @dev Check whether a tentative full-trade moving αNorm from
    ///      `alphaNormOld` to `alphaNormNew` crosses any tick boundary.
    ///
    ///      Direction is determined by sign(αNormNew − αNormOld). Within one
    ///      tentative trade αNorm moves monotonically, so only one direction
    ///      can be active and only the matching ticks are scanned. The two
    ///      branches use different optimization criteria, so they MUST NOT
    ///      share a single bestKNorm cursor (this was the latent bug from the
    ///      review — fixed by an explicit direction split).
    ///
    ///      Price RISING (αNormNew > αNormOld):
    ///        Interior ticks with αNormOld ≤ kNorm < αNormNew flip to boundary.
    ///        Pick the SMALLEST such kNorm (first boundary hit).
    ///
    ///      Price FALLING (αNormNew < αNormOld):
    ///        Boundary ticks with αNormNew < kNorm ≤ αNormOld flip to interior.
    ///        Pick the LARGEST such kNorm (first re-entry hit).
    ///
    /// @return crossed       True if any tick is crossed.
    /// @return crossTickIdx  Index of the first crossed tick.
    function _detectCrossing(uint256 alphaNormOld, uint256 alphaNormNew)
        internal
        view
        returns (bool crossed, uint256 crossTickIdx)
    {
        if (alphaNormNew == alphaNormOld) return (false, 0);

        uint256 len = ticks.length;

        if (alphaNormNew > alphaNormOld) {
            // Rising: scan interior ticks only, want smallest kNorm in band.
            uint256 bestKNorm = type(uint256).max;
            for (uint256 i; i < len; ++i) {
                TickLib.Tick storage t = ticks[i];
                if (!t.isInterior) continue;
                uint256 kNorm = FullMath.mulDiv(t.k, WAD, t.r);
                if (kNorm >= alphaNormOld && kNorm < alphaNormNew && kNorm < bestKNorm) {
                    bestKNorm    = kNorm;
                    crossTickIdx = i;
                    crossed      = true;
                }
            }
        } else {
            // Falling: scan boundary ticks only, want largest kNorm in band.
            uint256 bestKNorm = 0;
            for (uint256 i; i < len; ++i) {
                TickLib.Tick storage t = ticks[i];
                if (t.isInterior) continue;
                uint256 kNorm = FullMath.mulDiv(t.k, WAD, t.r);
                if (kNorm <= alphaNormOld && kNorm > alphaNormNew && kNorm > bestKNorm) {
                    bestKNorm    = kNorm;
                    crossTickIdx = i;
                    crossed      = true;
                }
            }
        }
    }

    /// @dev Compute (partialIn, partialOut) that moves αNorm exactly to the
    ///      crossing tick's kNorm, using the closed-form quadratic from paper
    ///      Section 13.
    ///
    ///      Derivation. Let p = partialOut, D = targetSumX − sumX_old. From
    ///      partialIn − partialOut = D and the sumXSq update identity
    ///      sumXSq' = sumXSq + 2·xi·partialIn + partialIn² − 2·xj·p + p²
    ///              = sumXSq + (2·xi·D + D²) + p·(2·(xi+D−xj)) + 2·p²
    ///      Setting sumXSq' = targetSumXSq gives
    ///        2p² + b·p + c = 0,  with
    ///        b = 2·(xi + D − xj),
    ///        c = sumXSq + 2·xi·D + D² − targetSumXSq.
    ///
    ///      All sumXSq-class values are WAD-scaled (Σx²/WAD), and xi/xj/D/p
    ///      are token amounts in WAD. b is WAD¹; c is WAD¹. To keep the
    ///      polynomial in a single WAD² scale we work with the equivalent
    ///      form  2p² + b·p + c·WAD = 0  where every term is WAD². This
    ///      eliminates the mixed-scale bug from the original implementation.
    ///
    ///      Discriminant:  b² − 8·c·WAD  (WAD²)
    ///      Roots:         (−b ± √disc) / 4   (WAD)
    /// @dev Quadratic-coefficient packet returned by _xoverCoeffs.
    ///      bCoef and cCoef are int256 in WAD¹ (token-amount scale).
    struct XoverCoeffs {
        int256  bCoef;
        int256  cCoef;
        bool    dPositive;
        uint256 D;
    }

    /// @dev Compute the polynomial coefficients (b, c) and the gap D for the
    ///      partial-trade quadratic at the boundary of `crossTickIdx`. Split
    ///      out from `_tradeToXover` purely to keep stack depth manageable.
    function _xoverCoeffs(
        TorusMath.TorusState memory ts,
        uint256[] memory res,
        uint256 assetIn,
        uint256 assetOut,
        uint256 crossTickIdx
    ) internal view returns (XoverCoeffs memory q) {
        uint256 sqrtN = SphereMath.sqrt(ts.n * WAD * WAD);

        // ── target sumX at crossing ────────────────────────────────────
        uint256 kNormCross = FullMath.mulDiv(
            ticks[crossTickIdx].k, WAD, ticks[crossTickIdx].r
        );
        uint256 alphaIntTarget = FullMath.mulDiv(kNormCross, ts.rInt, WAD);
        uint256 targetSumX     = FullMath.mulDiv(
            alphaIntTarget + ts.kBound, sqrtN, WAD
        );

        q.dPositive = targetSumX >= ts.sumX;
        q.D         = q.dPositive ? targetSumX - ts.sumX : ts.sumX - targetSumX;

        // ── target sumXSq from torus invariant LHS = rInt² ─────────────
        uint256 targetSumXSq;
        {
            uint256 rIntSqrtN = FullMath.mulDiv(ts.rInt, sqrtN, WAD);
            uint256 t1Abs = alphaIntTarget >= rIntSqrtN
                ? alphaIntTarget - rIntSqrtN
                : rIntSqrtN - alphaIntTarget;
            uint256 rIntSq  = FullMath.mulDiv(ts.rInt, ts.rInt, WAD);
            uint256 t1AbsSq = FullMath.mulDiv(t1Abs, t1Abs, WAD);
            uint256 CC      = rIntSq >= t1AbsSq ? rIntSq - t1AbsSq : 0;
            uint256 wNormTarget   = ts.sBound + SphereMath.sqrt(CC * WAD);
            uint256 wNormTargetSq = FullMath.mulDiv(wNormTarget, wNormTarget, WAD);
            targetSumXSq = wNormTargetSq
                         + FullMath.mulDiv(targetSumX, targetSumX, ts.n * WAD);
        }

        // ── b, c in WAD¹ ───────────────────────────────────────────────
        uint256 xi     = res[assetIn];
        uint256 xj     = res[assetOut];
        uint256 twoXiD = FullMath.mulDiv(2 * xi, q.D, WAD);
        uint256 DSq    = FullMath.mulDiv(q.D, q.D, WAD);

        if (q.dPositive) {
            uint256 xiPlusD = xi + q.D;
            q.bCoef = xiPlusD >= xj
                ? int256(2 * (xiPlusD - xj))
                : -int256(2 * (xj - xiPlusD));

            uint256 cPos = ts.sumXSq + twoXiD + DSq;
            q.cCoef = cPos >= targetSumXSq
                ? int256(cPos - targetSumXSq)
                : -int256(targetSumXSq - cPos);
        } else {
            uint256 xiMinusD = xi >= q.D ? xi - q.D : 0;
            q.bCoef = xiMinusD >= xj
                ? int256(2 * (xiMinusD - xj))
                : -int256(2 * (xj - xiMinusD));

            // c = sumXSq + DSq − 2·xi·D − targetSumXSq
            q.cCoef = int256(ts.sumXSq + DSq)
                    - int256(twoXiD)
                    - int256(targetSumXSq);
        }
    }

    /// @dev Solve  2p² + b·p + c·WAD = 0  (all WAD² scale) for the smallest
    ///      non-negative root. Closed-form first, then a Newton refinement
    ///      pass on f(p) = 2p² + b·p + c·WAD with f'(p) = 4p + b.
    function _solveXoverQuadratic(int256 bCoef, int256 cCoef)
        internal
        pure
        returns (uint256 p)
    {
        int256 wad  = int256(WAD);
        int256 disc = bCoef * bCoef - 8 * cCoef * wad;

        if (disc >= 0) {
            uint256 sq = SphereMath.sqrt(uint256(disc));
            int256 r1  = (-bCoef - int256(sq)) / 4;
            int256 r2  = (-bCoef + int256(sq)) / 4;
            if (r1 >= 0 && (r2 < 0 || r1 <= r2)) {
                p = uint256(r1);
            } else if (r2 >= 0) {
                p = uint256(r2);
            }
        } else {
            int256 vertex = -bCoef / 4;
            p = vertex > 0 ? uint256(vertex) : 0;
        }

        // Newton refinement.
        for (uint256 i; i < 30; ++i) {
            int256 ip   = int256(p);
            int256 fp   = 2 * ip * ip + bCoef * ip + cCoef * wad;
            int256 dfp  = 4 * ip + bCoef;
            if (dfp == 0) break;
            int256 step = fp / dfp;

            uint256 absStep = step < 0 ? uint256(-step) : uint256(step);
            if (step < 0) {
                p = p >= absStep ? p - absStep : 0;
            } else {
                p += absStep;
            }

            uint256 eps = p / 1_000_000;
            if (eps < 100) eps = 100;
            if (absStep < eps) break;
        }
    }

    function _tradeToXover(
        SwapState memory state,
        uint256[] memory res,
        uint256 assetIn,
        uint256 assetOut,
        uint256 crossTickIdx
    ) internal view returns (uint256 partialIn, uint256 partialOut) {
        XoverCoeffs memory q = _xoverCoeffs(
            state.torus, res, assetIn, assetOut, crossTickIdx
        );

        partialOut = _solveXoverQuadratic(q.bCoef, q.cCoef);
        partialIn  = q.dPositive
            ? q.D + partialOut
            : (partialOut >= q.D ? partialOut - q.D : 0);

        // Solver sanity bounds — revert loud rather than corrupt state.
        require(partialOut < res[assetOut],            "OrbitalPool: xover out > xj");
        require(partialIn  <= state.amountInRemaining, "OrbitalPool: xover in > rem");
    }

    /// @dev Cross tick `tickIdx`: flip interior↔boundary and update
    ///      the mutable SwapState torus params and slot0.
    ///      Asserts invariant holds at the crossover point.
    function _crossTick(uint256 tickIdx, SwapState memory state) internal {
        TickLib.Tick storage t = ticks[tickIdx];
        uint256 s = TorusMath.computeS(t.r, t.k, n);

        if (t.isInterior) {
            // Interior → Boundary
            state.torus.rInt   -= t.r;
            state.torus.kBound += t.k;
            state.torus.sBound += s;
            slot0.rInt          = state.torus.rInt;
            slot0.kBound        = state.torus.kBound;
            slot0.sBound        = state.torus.sBound;
        } else {
            // Boundary → Interior
            state.torus.rInt   += t.r;
            state.torus.kBound -= t.k;
            state.torus.sBound -= s;
            slot0.rInt          = state.torus.rInt;
            slot0.kBound        = state.torus.kBound;
            slot0.sBound        = state.torus.sBound;
        }

        t.isInterior = !t.isInterior;

        // Invariant must hold exactly at the crossover point.
        (bool ok, ) = TorusMath.checkInvariant(state.torus);
        require(ok, "OrbitalPool: invariant at crossing");

        emit TickCrossed(tickIdx, t.isInterior);
    }

    /// @dev Compute αNorm = (sumX/√n − kBound) / rInt for a torus state.
    ///      Returns max-uint256 when rInt is zero (all liquidity on boundary).
    function _alphaNormOf(TorusMath.TorusState memory ts, uint256 sumX)
        internal
        pure
        returns (uint256)
    {
        uint256 sqrtN    = SphereMath.sqrt(ts.n * WAD * WAD);
        uint256 alphaTot = FullMath.mulDiv(sumX, WAD, sqrtN);
        uint256 alphaInt = alphaTot >= ts.kBound ? alphaTot - ts.kBound : 0;
        return ts.rInt > 0
            ? FullMath.mulDiv(alphaInt, WAD, ts.rInt)
            : type(uint256).max;
    }

    /// @dev Apply a settled partial swap to the in-memory torus + reserve copy.
    ///      Mirrors `_updateReserves` but for the off-chain solver loop only.
    function _applyPartial(
        SwapState memory state,
        uint256[] memory res,
        uint256 assetIn,
        uint256 assetOut,
        uint256 partialIn,
        uint256 partialOut
    ) internal pure {
        uint256 xi = res[assetIn];   // pre-partial
        uint256 xj = res[assetOut];  // pre-partial

        res[assetIn]  = xi + partialIn;
        res[assetOut] = xj - partialOut;

        state.torus.sumX = state.torus.sumX + partialIn - partialOut;
        state.torus.sumXSq = state.torus.sumXSq
            + FullMath.mulDiv(2 * xi, partialIn,  WAD)
            + FullMath.mulDiv(partialIn,  partialIn,  WAD)
            - FullMath.mulDiv(2 * xj, partialOut, WAD)
            + FullMath.mulDiv(partialOut, partialOut, WAD);
    }

    /// @dev Solve the full swap amount, segmenting across tick crossings.
    ///      Loops up to 10 times (max crossings). Updates `state` in place.
    ///      Returns total amountOut.
    function _solveWithCrossings(
        SwapState memory state,
        uint256[] memory res,
        uint256 assetIn,
        uint256 assetOut
    ) internal returns (uint256 totalOut) {
        for (uint256 iter; iter < 10; ++iter) {
            if (state.amountInRemaining == 0) break;

            // αNormOld BEFORE the tentative trade.
            uint256 alphaNormOld = _alphaNormOf(state.torus, state.torus.sumX);

            // Snapshot sumX/sumXSq before solveSwap mutates them (it applies
            // the input side to state.torus in place).
            uint256 savedSumX   = state.torus.sumX;
            uint256 savedSumXSq = state.torus.sumXSq;

            // Tentative full trade against the current torus state.
            uint256 candidateOut = TorusMath.solveSwap(
                state.torus,
                assetIn,
                assetOut,
                state.amountInRemaining,
                res
            );

            // αNormNew under the tentative trade.  solveSwap already added
            // amountInRemaining to state.torus.sumX, so post-swap sumX is
            // state.torus.sumX − candidateOut.
            uint256 alphaNormNew = _alphaNormOf(
                state.torus,
                state.torus.sumX - candidateOut
            );

            // Restore the pre-solveSwap sumX/sumXSq so that crossing logic
            // (coefficients, partial-trade solver) operates on the un-mutated
            // torus state.
            state.torus.sumX   = savedSumX;
            state.torus.sumXSq = savedSumXSq;

            (bool crossed, uint256 crossIdx) =
                _detectCrossing(alphaNormOld, alphaNormNew);

            if (!crossed) {
                totalOut += candidateOut;
                state.amountInRemaining = 0;
                break;
            }

            // Partial trade up to the crossing point.
            (uint256 partialIn, uint256 partialOut) =
                _tradeToXover(state, res, assetIn, assetOut, crossIdx);

            totalOut                += partialOut;
            state.amountInRemaining -= partialIn;

            _applyPartial(state, res, assetIn, assetOut, partialIn, partialOut);

            _crossTick(crossIdx, state);
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3C-3 — swap (public entrypoint)
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Swap `amountIn` of `assetIn` for `assetOut`, delivering at
    ///         least `amountOutMin` to `recipient`. Uses the V3 callback
    ///         pattern: output is sent first, then the callback pulls input.
    function swap(
        address recipient,
        uint256 assetIn,
        uint256 assetOut,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes calldata data
    ) external lock returns (uint256 amountOut) {
        // ── Input validation ─────────────────────────────────────────
        require(amountIn > 0,                "OrbitalPool: amountIn=0");
        require(assetIn < n && assetOut < n, "OrbitalPool: bad asset");
        require(assetIn != assetOut,         "OrbitalPool: same asset");
        require(slot0.rInt > 0,              "OrbitalPool: no liquidity");

        // ── Fee + solve ───────────────────────────────────────────────
        uint256 amountInNet;
        uint256 feeAmount;
        {
            feeAmount   = FullMath.mulDiv(amountIn, fee, 1_000_000);
            amountInNet = amountIn - feeAmount;
            // Credit feeGrowthGlobal[assetIn] to interior LPs. Tokens will
            // sit in feesAccrued[assetIn] once they arrive in the callback.
            _accumulateFee(assetIn, feeAmount);
        }

        {
            SwapState memory state;
            state.torus             = _buildTorusState();
            state.amountInRemaining = amountInNet;
            uint256[] memory res    = _currentReserves();
            amountOut = _solveWithCrossings(state, res, assetIn, assetOut);
        }

        require(amountOut > 0,             "OrbitalPool: amountOut=0");
        require(amountOut >= amountOutMin,  "OrbitalPool: slippage");

        // ── Oracle write BEFORE state update so cumulatives integrate
        //    the pre-swap price over the elapsed window (V3 convention).
        (observationIndex, observationCardinality) = OrbitalOracle.write(
            observations,
            observationIndex,
            uint32(block.timestamp),
            slot0.sumX,
            slot0.sumXSq,
            observationCardinality,
            observationCardinalityNext
        );

        // ── Reserve accounting ────────────────────────────────────────
        _updateReserves(assetIn, assetOut, amountInNet, amountOut);

        // ── Transfer out, callback in, verify ────────────────────────
        TransferHelper.safeTransfer(tokens[assetOut], recipient, amountOut);

        {
            uint256 balBefore = IERC20Minimal(tokens[assetIn]).balanceOf(address(this));
            IOrbitalSwapCallback(msg.sender).orbitalSwapCallback(assetIn, amountIn, data);
            require(
                IERC20Minimal(tokens[assetIn]).balanceOf(address(this)) - balBefore >= amountIn,
                "OrbitalPool: S0"
            );
        }

        // ── Invariant ─────────────────────────────────────────────────
        (bool ok, ) = TorusMath.checkInvariant(_buildTorusState());
        require(ok, "OrbitalPool: invariant");

        emit Swap(msg.sender, recipient, assetIn, assetOut, amountIn, amountOut);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3C-4 — burn (remove liquidity)
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Remove `rWad` of liquidity from tick `tickIndex`.
    ///         Credits token amounts to `tokensOwed`; caller must `collect`.
    function burn(uint256 tickIndex, uint256 rWad)
        external
        lock
        returns (uint256[] memory amounts)
    {
        require(rWad > 0, "OrbitalPool: rWad=0");

        bytes32 pKey = PositionLib.positionKey(msg.sender, tickIndex);
        PositionLib.Position storage pos = positions[pKey];

        require(pos.r >= rWad, "OrbitalPool: insufficient liquidity");

        // Settle fees before modifying position.
        _updatePositionFees(pKey, pos.r);

        TickLib.Tick storage t = ticks[tickIndex];

        // Compute pro-rata withdrawal amounts.
        amounts = _computeWithdrawAmounts(tickIndex, rWad);

        // ── Update slot0 torus params + tick.k / tick.s in lockstep ──
        //
        // Boundary tick: shrink the tick's k *and* the slot0 kBound/sBound
        // by the same proportion (rWad / tick.r). Failing to shrink t.k
        // means a future interior→boundary cross-back would re-add the
        // full original k (state corruption — caught by issue #1 review).
        //
        // We compute kRemove / sRemove against the *current* t.k, t.r so
        // the relation kNorm = t.k / t.r is preserved across the burn.
        if (t.isInterior) {
            slot0.rInt -= rWad;
        } else {
            uint256 kRemove = FullMath.mulDiv(t.k, rWad, t.r);
            uint256 sFull   = TorusMath.computeS(t.r, t.k, n);
            uint256 sRemove = FullMath.mulDiv(sFull, rWad, t.r);
            slot0.kBound -= kRemove;
            slot0.sBound -= sRemove;
            // Keep tick.k consistent with the reduced tick.r so kNorm holds.
            t.k -= kRemove;
        }

        // ── Update sumX / sumXSq ─────────────────────────────────────
        uint256 totalRemoved;
        for (uint256 i; i < n; ++i) {
            totalRemoved += amounts[i];
        }
        slot0.sumX -= totalRemoved;

        // sumXSq: subtract the squared change per asset.
        // Uses saturating subtraction at the end to absorb ≤ n wei of
        // mulDiv rounding dust between the mint and burn paths.
        {
            uint256 totalSqRemoved;
            for (uint256 i; i < n; ++i) {
                uint256 xOld = reserves[i];
                uint256 amt  = amounts[i];
                // xOld² - (xOld-amt)² = 2*xOld*amt - amt²
                totalSqRemoved += FullMath.mulDiv(2 * xOld, amt, WAD)
                                - FullMath.mulDiv(amt, amt, WAD);
            }
            slot0.sumXSq = slot0.sumXSq > totalSqRemoved
                ? slot0.sumXSq - totalSqRemoved
                : 0;
        }

        // ── Update reserves ──────────────────────────────────────────
        for (uint256 i; i < n; ++i) {
            reserves[i] -= amounts[i];
        }

        // ── Update tick and position ─────────────────────────────────
        t.r               -= rWad;
        t.liquidityGross  -= uint128(rWad);
        pos.r             -= rWad;

        if (pos.r == 0) {
            // Tokens may still be owed; collect must be called separately
            // before burn-to-zero if the LP wants to drain everything.
            delete positions[pKey];
        }

        // ── Push withdrawn principal to caller ───────────────────────
        for (uint256 i; i < n; ++i) {
            if (amounts[i] > 0) {
                TransferHelper.safeTransfer(tokens[i], msg.sender, amounts[i]);
            }
        }

        // ── Invariant check ──────────────────────────────────────────
        if (slot0.rInt > 0) {
            (bool ok, ) = TorusMath.checkInvariant(_buildTorusState());
            require(ok, "OrbitalPool: invariant");
        }

        emit Burn(msg.sender, tickIndex, rWad, amounts);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 3C-5 — collect (fees)
    // ─────────────────────────────────────────────────────────────────────

    /// @notice Collect accrued fees for caller's position at `tickIndex`.
    ///         Pays out the per-asset `tokensOwed` accumulator, drawn from
    ///         the per-asset `feesAccrued` bucket the swap path stashes
    ///         tokens into. Asset i is paid in the actual token i — no
    ///         cross-asset rebalancing.
    function collect(uint256 tickIndex)
        external
        lock
        returns (uint256[] memory fees)
    {
        bytes32 pKey = PositionLib.positionKey(msg.sender, tickIndex);
        PositionLib.Position storage pos = positions[pKey];

        // Settle any pending fees into per-asset tokensOwed.
        _updatePositionFees(pKey, pos.r);

        fees = new uint256[](n);
        bool any;
        for (uint256 i; i < n; ++i) {
            uint256 owed = tokensOwed[pKey][i];
            if (owed == 0) continue;

            // Defensive: cannot pay out more than the pool actually holds
            // in the per-asset fee bucket. Underflow here would indicate a
            // state bug — revert loud rather than silently truncate.
            require(feesAccrued[i] >= owed, "OrbitalPool: fee bucket short");

            tokensOwed[pKey][i] = 0;
            feesAccrued[i]     -= owed;
            fees[i]             = owed;
            any                 = true;

            TransferHelper.safeTransfer(tokens[i], msg.sender, owed);
        }

        require(any, "OrbitalPool: nothing owed");

        emit Collect(msg.sender, tickIndex, fees);
    }
}
