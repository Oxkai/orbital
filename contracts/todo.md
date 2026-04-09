# Orbital AMM — Contracts TODO

> Folder: `contracts/`
> Framework: Foundry
> Reference: https://www.paradigm.xyz/2025/06/orbital

---

## Setup

- [ ] Run `forge init contracts/`
- [ ] Install deps: `forge install transmissions11/solmate`
- [ ] Install deps: `forge install PaulRBerg/prb-math`
- [ ] Install deps: `forge install OpenZeppelin/openzeppelin-contracts`
- [ ] Install deps: `forge install Uniswap/v3-core` (for FullMath + TransferHelper)
- [ ] Configure `foundry.toml`:
  - [ ] solc version `0.8.24`
  - [ ] optimizer runs `200`
  - [ ] `via_ir = true`
- [ ] Create folder `contracts/src/lib/`
- [ ] Create folder `contracts/src/core/`
- [ ] Create folder `contracts/src/interfaces/`
- [ ] Create folder `contracts/src/periphery/`
- [ ] Create folder `contracts/src/mocks/`
- [ ] Create folder `contracts/test/`
- [ ] Create folder `contracts/script/`
- [ ] Create folder `contracts/deployments/`
- [ ] Create `.env.example` with: `PRIVATE_KEY`, `SEPOLIA_RPC_URL`, `ETHERSCAN_API_KEY`

---

---

## Part 1 — Math Libraries

> `contracts/src/lib/`
> Pure functions only. No storage. No state. All `internal`.
> Build and test each file before moving to the next.

---

### 1A — `FullMath.sol`

- [X] Copy `FullMath.sol` from Uniswap V3 core repo exactly
- [X] Copy `TransferHelper.sol` from Uniswap V3 periphery repo exactly
- [X] Do not modify either file
- [X] Confirm both compile with `forge build`

---

### 1B — `SphereMath.sol`

> Core sphere geometry from paper Section 4.1 and 4.2

- [ ] Create `contracts/src/lib/SphereMath.sol`
- [ ] Define `uint256 constant WAD = 1e18`
- [ ] Define `uint256 constant WAD2 = 1e36`
- [ ] Implement `sqrt(uint256 x)`:
  - [ ] Babylonian integer method
  - [ ] Returns floor of square root
  - [ ] Handles x = 0 edge case
- [ ] Implement `equalPricePoint(uint256 r, uint256 n)`:
  - [ ] Formula: q = r(1 - 1/√n)
  - [ ] Returns WAD-scaled result
- [ ] Implement `computeAlpha(uint256 sumX, uint256 n)`:
  - [ ] Formula: Σxᵢ / √n
  - [ ] Use FullMath.mulDiv for division
- [ ] Implement `computeWNormSq(uint256[] reserves, uint256 n)`:
  - [ ] Formula: Σ(xᵢ - mean)² — cancellation-safe
  - [ ] Do NOT use Σxᵢ² - (Σxᵢ)²/n — catastrophic cancellation
  - [ ] Use FullMath.mulDiv for each squared term
- [ ] Implement `spotPrice(uint256 r, uint256 xi, uint256 xj)`:
  - [ ] Formula: (r - xⱼ) / (r - xᵢ) in WAD
  - [ ] Require r > xj and r > xi
  - [ ] Use FullMath.mulDiv
- [ ] Implement `checkSphereInvariant(uint256 sumX, uint256 sumXSq, uint256 r, uint256 n)`:
  - [ ] Compute ||r_vec - x_vec||² = nr² - 2rΣxᵢ + Σxᵢ²
  - [ ] Compare to r² with relative tolerance
  - [ ] Tolerance: relative drift < 1e-6 (drift * 1e6 < rhs)

---

### 1C — `TickLib.sol`

> Tick geometry from paper Section 4.5, 4.6, 4.7, 4.8, 4.9

- [ ] Create `contracts/src/lib/TickLib.sol`
- [ ] Define `Tick` struct:
  - [ ] `uint256 k` — plane constant in WAD
  - [ ] `uint256 r` — radius contribution in WAD
  - [ ] `bool isInterior` — current status
  - [ ] `uint256 feeGrowthInside` — fee tracker
  - [ ] `uint128 liquidityGross` — total r in integer units
- [ ] Implement `kMin(uint256 r, uint256 n)`:
  - [ ] Formula: r(√n - 1) in WAD
- [ ] Implement `kMax(uint256 r, uint256 n)`:
  - [ ] Formula: r(n-1)/√n in WAD
- [ ] Implement `kFromDepegPrice(uint256 r, uint256 n, uint256 pWad)`:
  - [ ] Formula from paper Section 4.8
  - [ ] k = r√n - r(p + n-1) / √(n(p² + n-1))
  - [ ] pWad = depeg price in WAD (e.g. 0.99e18)
- [ ] Implement `capitalEfficiency(uint256 r, uint256 n, uint256 k)`:
  - [ ] Formula: xBase / (xBase - xMin) in WAD
  - [ ] Returns 1e18 (1x) if k = kMax
- [ ] Implement `xMin(uint256 r, uint256 n, uint256 k)` (internal):
  - [ ] Formula from paper Section 4.7
  - [ ] xMin = (k√n - √(k²n - n((n-1)r - k√n)²)) / n
- [ ] Implement `xMax(uint256 r, uint256 n, uint256 k)` (internal):
  - [ ] Same formula but + instead of - before sqrt
  - [ ] Cap at r: return min(computed, r)
- [ ] Implement `boundaryRadius(uint256 r, uint256 k, uint256 n)`:
  - [ ] Formula: s = √(r² - (k - r√n)²)
  - [ ] Require k in valid range

---

### 1D — `TorusMath.sol`

> Global torus invariant from paper Section 4.11, 4.12, 4.13

- [ ] Create `contracts/src/lib/TorusMath.sol`
- [ ] Define `TorusState` struct:
  - [ ] `uint256 rInt` — consolidated interior radius
  - [ ] `uint256 kBound` — Σk of all boundary ticks
  - [ ] `uint256 sBound` — Σs of all boundary ticks
  - [ ] `uint256 sumX` — Σxᵢ total reserves
  - [ ] `uint256 sumXSq` — Σxᵢ² total reserves
  - [ ] `uint256 n` — number of assets
- [ ] Implement `torusLHS(TorusState memory s)`:
  - [ ] Compute alphaTot = sumX / √n
  - [ ] Compute alphaInt = alphaTot - kBound
  - [ ] Compute rIntSqrtN = rInt * √n
  - [ ] term1 = |alphaInt - rIntSqrtN|
  - [ ] Compute wNorm from sumX and sumXSq
  - [ ] term2 = |wNorm - sBound|
  - [ ] Return term1² + term2²
- [ ] Implement `checkInvariant(TorusState memory s)`:
  - [ ] Compute lhs = torusLHS(s)
  - [ ] Compute rhs = rInt²
  - [ ] Handle rhs = 0 edge case (all ticks on boundary)
  - [ ] Return (bool ok, uint256 relativeDrift)
  - [ ] Relative drift = |lhs - rhs| / rhs
  - [ ] ok = relativeDrift < 1e12 (1e-6 in WAD)
- [ ] Implement `solveSwap(TorusState memory s, uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256[] memory reserves)`:
  - [ ] Update sumX and sumXSq for input side first
  - [ ] Initial guess: amountOut = amountIn * 999 / 1000
  - [ ] Loop 15 iterations of Newton's method
  - [ ] Convergence: break when step < 2 wei
  - [ ] Return amountOut
- [ ] Implement `computeS(uint256 r, uint256 k, uint256 n)`:
  - [ ] Formula: √(r² - (k - r√n)²)
  - [ ] Require r² >= (k - r√n)²
- [ ] Implement `alphaNorm(uint256 alphaInt, uint256 rInt)`:
  - [ ] Return alphaInt * WAD / rInt
  - [ ] Return type(uint256).max if rInt = 0

---

### 1E — `PositionLib.sol`

> LP position tracking, mirrors Uniswap V3 Position.sol

- [ ] Create `contracts/src/lib/PositionLib.sol`
- [ ] Define `Position` struct:
  - [ ] `uint256 tickIndex`
  - [ ] `uint256 r`
  - [ ] `uint256 feeGrowthInsideLast`
  - [ ] `uint128 tokensOwed`
- [ ] Implement `positionKey(address owner, uint256 tickIndex)`:
  - [ ] Return keccak256(abi.encodePacked(owner, tickIndex))
- [ ] Implement `get(mapping(bytes32 => Position) storage, address owner, uint256 tickIndex)`:
  - [ ] Return position by key
- [ ] Implement `updateFees(Position storage pos, uint256 feeGrowthGlobal)`:
  - [ ] Compute growth = feeGrowthGlobal - pos.feeGrowthInsideLast
  - [ ] Add pro-rata fees to pos.tokensOwed
  - [ ] Update pos.feeGrowthInsideLast

---

### 1F — `OrbitalOracle.sol`

> TWAP oracle, mirrors Uniswap V3 Oracle.sol

- [ ] Create `contracts/src/lib/OrbitalOracle.sol`
- [ ] Define `Observation` struct:
  - [ ] `uint32 blockTimestamp`
  - [ ] `uint256 cumulativeSumX` — time-weighted sumX
  - [ ] `uint256 cumulativeSumXSq` — time-weighted sumXSq
  - [ ] `bool initialized`
- [ ] Implement `initialize(Observation[65535] storage, uint32 time, uint256 sumX, uint256 sumXSq)`:
  - [ ] Write first observation at index 0
- [ ] Implement `write(observations, index, blockTimestamp, sumX, sumXSq, cardinality, cardinalityNext)`:
  - [ ] Skip if same block as last observation
  - [ ] Write new observation at next index
  - [ ] Return new index and cardinality
- [ ] Implement `transform(Observation memory last, uint32 blockTimestamp, uint256 sumX, uint256 sumXSq)`:
  - [ ] Compute cumulative values from last observation to now
- [ ] Implement `observe(observations, time, secondsAgos[], sumX, sumXSq, index, cardinality)`:
  - [ ] Binary search for target timestamp
  - [ ] Interpolate between observations
  - [ ] Return cumulativeSumX[], cumulativeSumXSq[]
- [ ] Implement `grow(observations, current, next)`:
  - [ ] Initialize new slots up to `next`
  - [ ] Return new cardinality

---

### Part 1 Tests — `contracts/test/SphereMath.t.sol`

- [ ] Create `contracts/test/SphereMath.t.sol`
- [ ] `test_sqrt_zero` — sqrt(0) = 0
- [ ] `test_sqrt_perfect_squares` — sqrt(4), sqrt(9), sqrt(16), sqrt(1e18)
- [ ] `test_sqrt_floor` — sqrt(x)² ≤ x always
- [ ] `test_equalPricePoint_n2` — verify formula for n=2
- [ ] `test_equalPricePoint_n3` — verify for n=3
- [ ] `test_equalPricePoint_n4` — verify for n=4
- [ ] `test_spotPrice_at_equal_price_is_one` — price = 1.0 when xᵢ = xⱼ
- [ ] `test_spotPrice_directional` — adding xᵢ makes asset i cheaper
- [ ] `test_wNormSq_zero_at_equal_price` — ||w||² = 0 when all equal
- [ ] `test_wNormSq_nonzero_after_imbalance`
- [ ] `test_sphereInvariant_holds_at_equalPrice`
- [ ] `fuzz_sqrt(uint256 x)` — sqrt(x)² ≤ x always

### Part 1 Tests — `contracts/test/TickLib.t.sol`

- [ ] Create `contracts/test/TickLib.t.sol`
- [ ] `test_kMin_lt_kMax_n2` through `test_kMin_lt_kMax_n10`
- [ ] `test_kFromDepegPrice_099` — tight tick near kMin
- [ ] `test_kFromDepegPrice_090` — wide tick
- [ ] `test_kFromDepegPrice_000` — returns kMax
- [ ] `test_capitalEfficiency_gt_one_below_kMax`
- [ ] `test_capitalEfficiency_one_at_kMax`
- [ ] `test_xMin_lt_xBase` — xMin < equal price point reserve
- [ ] `test_boundaryRadius_leq_r` — s ≤ r always
- [ ] `fuzz_kFromDepegPrice(uint256 p)` — result always in [kMin, kMax]

### Part 1 Tests — `contracts/test/TorusMath.t.sol`

- [ ] Create `contracts/test/TorusMath.t.sol`
- [ ] `test_torusLHS_at_equal_price_equals_rIntSq`
- [ ] `test_checkInvariant_valid_state_returns_true`
- [ ] `test_checkInvariant_corrupted_state_returns_false`
- [ ] `test_solveSwap_output_positive`
- [ ] `test_solveSwap_invariant_holds_after`
- [ ] `test_solveSwap_symmetry` — swap A→B then B→A ≈ original
- [ ] `test_computeS_leq_r`
- [ ] `test_alphaNorm_one_at_equal_price`
- [ ] `test_alphaNorm_max_when_rInt_zero`
- [ ] `fuzz_solveSwap_invariant(uint256 amountIn)` — invariant holds for any size

---

---

## Part 2 — Interfaces

> `contracts/src/interfaces/`
> Declare everything before implementing. No logic here.

- [ ] Create `contracts/src/interfaces/IOrbitalFactory.sol`:
  - [ ] `createPool(address[] tokens, uint24 fee)` returns address
  - [ ] `getPool(bytes32 tokenSetHash)` returns address
  - [ ] `owner()` returns address
  - [ ] `PoolCreated` event
- [ ] Create `contracts/src/interfaces/IOrbitalPoolState.sol`:
  - [ ] `factory()`, `tokens(uint256)`, `n()`, `fee()`
  - [ ] `slot0()` — returns sumX, sumXSq, rInt, kBound, sBound, unlocked
  - [ ] `reserves(uint256 assetIndex)` returns uint256
  - [ ] `feeGrowthGlobal()` returns uint256
  - [ ] `ticks(uint256 index)` returns Tick struct
  - [ ] `positions(bytes32 key)` returns Position struct
- [ ] Create `contracts/src/interfaces/IOrbitalPoolActions.sol`:
  - [ ] `mint(address recipient, uint256 kWad, uint256 rWad, bytes data)` returns uint256[] amounts
  - [ ] `swap(address recipient, uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256 amountOutMin, bytes data)` returns uint256 amountOut
  - [ ] `burn(uint256 tickIndex, uint256 rWad)` returns uint256[] amounts
  - [ ] `collect(uint256 tickIndex)` returns uint256[] fees
- [ ] Create `contracts/src/interfaces/IOrbitalPoolEvents.sol`:
  - [ ] `Mint(address recipient, uint256 kWad, uint256 rWad, uint256[] amounts)`
  - [ ] `Swap(address sender, address recipient, uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256 amountOut)`
  - [ ] `Burn(address owner, uint256 tickIndex, uint256 rWad, uint256[] amounts)`
  - [ ] `Collect(address owner, uint256 tickIndex, uint256[] fees)`
  - [ ] `TickCrossed(uint256 tickIndex, bool newIsInterior)`
- [ ] Create `contracts/src/interfaces/IOrbitalPoolOwnerActions.sol`:
  - [ ] `setFeeProtocol(uint8 feeProtocol)`
  - [ ] `collectProtocol(address recipient)` returns uint256[] fees
- [ ] Create `contracts/src/interfaces/IOrbitalPool.sol`:
  - [ ] Inherits all pool interfaces above
- [ ] Create `contracts/src/interfaces/IOrbitalMintCallback.sol`:
  - [ ] `orbitalMintCallback(uint256[] amounts, bytes data)`
- [ ] Create `contracts/src/interfaces/IOrbitalSwapCallback.sol`:
  - [ ] `orbitalSwapCallback(uint256 assetIn, uint256 amountIn, bytes data)`

---

---

## Part 3 — Core Contracts

> `contracts/src/core/`
> The trustless heart of the system. No upgrades. No proxies.

---

### 3A — `OrbitalPoolDeployer.sol`

- [ ] Create `contracts/src/core/OrbitalPoolDeployer.sol`
- [ ] Define `Parameters` struct — factory, tokens[], fee
- [ ] Store parameters in contract storage temporarily
- [ ] Implement `deploy(factory, tokens[], fee)`:
  - [ ] Set parameters in storage
  - [ ] Deploy new OrbitalPool via `new OrbitalPool{salt: salt}()`
  - [ ] Clear parameters from storage after deploy
  - [ ] Return deployed pool address
- [ ] Only callable by factory

---

### 3B — `OrbitalFactory.sol`

- [ ] Create `contracts/src/core/OrbitalFactory.sol`
- [ ] Inherits OrbitalPoolDeployer
- [ ] Storage:
  - [ ] `address public owner`
  - [ ] `mapping(bytes32 => address) public getPool`
  - [ ] `address[] public allPools`
  - [ ] `mapping(uint24 => bool) public feeAmountEnabled`
- [ ] Constructor:
  - [ ] Set owner = msg.sender
  - [ ] Enable default fee tiers: 100, 500, 3000, 10000
- [ ] Implement `createPool(address[] tokens, uint24 fee)`:
  - [ ] Require fee is enabled
  - [ ] Require tokens.length >= 2
  - [ ] Require all token addresses are valid and unique
  - [ ] Compute tokenSetHash = keccak256(sorted token addresses + fee)
  - [ ] Require pool does not already exist
  - [ ] Deploy via OrbitalPoolDeployer.deploy
  - [ ] Store in getPool mapping and allPools array
  - [ ] Emit PoolCreated
- [ ] Implement `enableFeeAmount(uint24 fee)`:
  - [ ] Only owner
  - [ ] Add to feeAmountEnabled
- [ ] Implement `setOwner(address newOwner)`:
  - [ ] Only current owner
  - [ ] Two-step transfer pattern

---

### 3C — `OrbitalPool.sol`

> The main contract. Implement feature by feature.

- [ ] Create `contracts/src/core/OrbitalPool.sol`

**3C-1 Storage and constructor**
- [ ] Declare all imports (FullMath, SphereMath, TorusMath, TickLib, PositionLib, OrbitalOracle)
- [ ] Declare immutables: factory, tokens[], n, fee
- [ ] Declare Slot0 struct and `slot0` variable
- [ ] Declare `reserves` mapping
- [ ] Declare `feeGrowthGlobal`
- [ ] Declare `ticks` array and `numTicks`
- [ ] Declare `positions` mapping
- [ ] Declare oracle observations array
- [ ] Implement constructor — read from OrbitalPoolDeployer.parameters
- [ ] Implement `lock` modifier using slot0.unlocked

**3C-2 Mint (add liquidity)**
- [ ] Implement `mint(recipient, kWad, rWad, data)`:
  - [ ] Validate k is in [kMin, kMax] range
  - [ ] Validate rWad > 0
  - [ ] Compute deposit amounts based on current pool state
  - [ ] If pool is at equal-price point: deposit q per asset minus virtual
  - [ ] If pool is imbalanced: deposit at current reserve ratios
  - [ ] Insert tick into ticks array (sorted by k)
  - [ ] Update slot0.rInt += rWad
  - [ ] Update slot0.sumX and slot0.sumXSq
  - [ ] Update reserves[]
  - [ ] Store Position in positions mapping
  - [ ] Call IOrbitalMintCallback to pull tokens
  - [ ] Verify tokens were received
  - [ ] Assert invariant holds after mint
  - [ ] Emit Mint event

**3C-3 Swap (core feature)**
- [ ] Implement `swap(recipient, assetIn, assetOut, amountIn, amountOutMin, data)`:
  - [ ] Validate inputs (nonzero, valid indices, different assets)
  - [ ] Require rInt > 0
  - [ ] Compute fee: feeAmount = amountIn * fee / 1_000_000
  - [ ] amountInNet = amountIn - feeAmount
  - [ ] Call `_accumulateFee(feeAmount)`
  - [ ] Call `_solveWithCrossings(...)` to get amountOut
  - [ ] Require amountOut >= amountOutMin
  - [ ] Require amountOut > 0
  - [ ] Call `_updateReserves(assetIn, assetOut, amountInNet, amountOut)`
  - [ ] Transfer output tokens to recipient
  - [ ] Call IOrbitalSwapCallback to pull input tokens
  - [ ] Verify input tokens were received
  - [ ] Write oracle observation
  - [ ] Assert invariant holds after swap
  - [ ] Emit Swap event
- [ ] Implement `_solveWithCrossings(state, res, assetIn, assetOut, amountIn)`:
  - [ ] Loop up to 10 iterations (max tick crossings)
  - [ ] Each iteration: attempt full trade with current torus state
  - [ ] Call `_detectCrossing(rInt, alphaNormNew)` to check
  - [ ] If no crossing: accept result, exit loop
  - [ ] If crossing: call `_tradeToXover(...)` for partial trade
  - [ ] Call `_crossTick(tickIdx, state)` to update params
  - [ ] Continue loop with remaining amount
- [ ] Implement `_detectCrossing(rInt, alphaNormNew)`:
  - [ ] Loop through all ticks
  - [ ] Interior tick: crossing if alphaNormNew > tick.kNorm
  - [ ] Boundary tick: crossing if alphaNormNew < tick.kNorm
  - [ ] Return (bool crossed, uint256 crossingTickIdx)
- [ ] Implement `_tradeToXover(state, res, assetIn, assetOut, remaining, crossTickIdx)`:
  - [ ] Compute target alphaTotal at crossing point
  - [ ] alphaXover = rInt * kNorm_crossing + kBoundTotal
  - [ ] Use quadratic formula from paper Section 13 to find partialIn
  - [ ] Solve: djCrossover = √n * (alphaTotal - alphaXover) + diCrossover
  - [ ] Substitute into torus invariant → quadratic in diCrossover
  - [ ] Return (partialIn, partialOut)
- [ ] Implement `_crossTick(tickIdx, state)`:
  - [ ] If interior → boundary:
    - [ ] state.rInt -= tick.r
    - [ ] state.kBound += tick.k
    - [ ] state.sBound += computeS(tick.r, tick.k, n)
    - [ ] slot0 same updates
  - [ ] If boundary → interior:
    - [ ] state.rInt += tick.r
    - [ ] state.kBound -= tick.k
    - [ ] state.sBound -= computeS(tick.r, tick.k, n)
    - [ ] slot0 same updates
  - [ ] Flip tick.isInterior
  - [ ] Assert invariant holds at crossover before continuing
  - [ ] Emit TickCrossed

**3C-4 Burn (remove liquidity)**
- [ ] Implement `burn(tickIndex, rWad)`:
  - [ ] Look up position by positionKey(msg.sender, tickIndex)
  - [ ] Require position.r >= rWad
  - [ ] Call `_updatePositionFees(pos)` before modifying
  - [ ] Compute withdraw amounts proportional to rWad / tick.r
  - [ ] If tick is interior: slot0.rInt -= rWad
  - [ ] If tick is boundary: slot0.kBound -= proportional k, slot0.sBound -= proportional s
  - [ ] Update slot0.sumX, slot0.sumXSq
  - [ ] Update reserves[]
  - [ ] Update position.r -= rWad
  - [ ] Delete position if r == 0
  - [ ] Assert invariant holds after burn
  - [ ] Emit Burn event

**3C-5 Collect (fees)**
- [ ] Implement `collect(tickIndex)`:
  - [ ] Look up position
  - [ ] Call `_updatePositionFees(pos)`
  - [ ] Read pos.tokensOwed
  - [ ] Reset pos.tokensOwed = 0
  - [ ] Distribute fees pro-rata across all n assets
  - [ ] Transfer each fee amount to msg.sender
  - [ ] Emit Collect event

**3C-6 Fee accounting**
- [ ] Implement `_accumulateFee(feeAmount)`:
  - [ ] If rInt == 0 skip (no interior liquidity to credit)
  - [ ] feeGrowthGlobal += feeAmount * WAD / rInt
- [ ] Implement `_updatePositionFees(Position storage pos)`:
  - [ ] growth = feeGrowthGlobal - pos.feeGrowthInsideLast
  - [ ] pos.tokensOwed += pos.r * growth / WAD
  - [ ] pos.feeGrowthInsideLast = feeGrowthGlobal

**3C-7 Reserve accounting helpers**
- [ ] Implement `_updateReserves(assetIn, assetOut, amountIn, amountOut)`:
  - [ ] Update slot0.sumX: += amountIn, -= amountOut
  - [ ] Update slot0.sumXSq using (x+d)² - x² = 2xd + d²
  - [ ] Update reserves[assetIn] += amountIn
  - [ ] Update reserves[assetOut] -= amountOut
- [ ] Implement `_buildTorusState()` returns TorusMath.TorusState:
  - [ ] Assemble from slot0 fields
- [ ] Implement `_currentReserves()` returns uint256[]:
  - [ ] Copy from reserves mapping into array
- [ ] Implement `_computeDepositAmounts(kWad, rWad)`:
  - [ ] If pool empty: return equalPricePoint amounts minus virtual
  - [ ] If pool imbalanced: compute amounts to maintain current prices
- [ ] Implement `_computeWithdrawAmounts(tickIndex, rWad)`:
  - [ ] Return pro-rata share of pool reserves for this tick's rWad

**3C-8 Oracle**
- [ ] Implement `observe(uint32[] secondsAgos)`:
  - [ ] Call OrbitalOracle.observe with current state
  - [ ] Return cumulative sumX and sumXSq arrays
- [ ] Implement `increaseObservationCardinalityNext(uint16 next)`:
  - [ ] Call OrbitalOracle.grow

---

### Part 3 Tests — `contracts/test/OrbitalPool.t.sol`

- [ ] Create `contracts/test/OrbitalPool.t.sol`
- [ ] Setup: deploy MockTokens, Factory, Pool, add MockCallbacks

**Mint tests**
- [ ] `test_mint_empty_pool` — first LP, prices all 1.0
- [ ] `test_mint_second_lp_same_k` — two LPs same tick
- [ ] `test_mint_multiple_ticks` — 4 LPs at different k values
- [ ] `test_mint_mid_session_imbalanced` — LP joins after swaps
- [ ] `test_mint_reverts_invalid_k` — k outside [kMin, kMax]
- [ ] `test_mint_reverts_zero_r`

**Swap tests**
- [ ] `test_swap_basic` — 0.1% of pool, invariant holds
- [ ] `test_swap_medium` — 1% of pool
- [ ] `test_swap_large` — 5% of pool
- [ ] `test_swap_all_pairs` — test every asset pair
- [ ] `test_swap_symmetry` — swap A→B then B→A ≈ original
- [ ] `test_swap_price_impact_increases_with_size`
- [ ] `test_swap_fee_deducted_correctly`
- [ ] `test_swap_slippage_protection_reverts`
- [ ] `test_swap_deadline_respected` (via router)
- [ ] `test_swap_zero_amount_reverts`
- [ ] `test_swap_no_liquidity_reverts`
- [ ] `test_swap_same_asset_reverts`

**Tick crossing tests**
- [ ] `test_swap_crosses_one_tick` — single crossing, invariant holds
- [ ] `test_swap_crosses_two_ticks` — double crossing
- [ ] `test_swap_crosses_three_ticks`
- [ ] `test_tick_crossing_output_nonzero` — no zero output bug
- [ ] `test_tick_boundary_to_interior` — large swap other direction, tick re-enters
- [ ] `test_depeg_scenario` — 50 one-directional swaps, all ticks hit boundary

**Burn tests**
- [ ] `test_burn_full_position`
- [ ] `test_burn_partial_position`
- [ ] `test_burn_returns_correct_amounts`
- [ ] `test_burn_reverts_insufficient_liquidity`
- [ ] `test_burn_updates_rInt`

**Collect tests**
- [ ] `test_collect_after_swaps` — fees accumulate correctly
- [ ] `test_collect_pro_rata_by_r` — LP1 gets more fees than LP4
- [ ] `test_collect_zero_before_swaps`
- [ ] `test_collect_after_burn`

**Invariant tests (Foundry)**
- [ ] `invariant_sumX_matches_reserves` — Σreserves[i] == sumX always
- [ ] `invariant_torus_holds` — checkInvariant true after every action
- [ ] `invariant_no_negative_reserves` — reserves[i] >= 0 always
- [ ] `invariant_rInt_matches_interior_ticks` — rInt == Σr of interior ticks

**Fuzz tests**
- [ ] `fuzz_swap_invariant(uint256 amountIn, uint8 assetIn, uint8 assetOut)`
- [ ] `fuzz_mint_burn_roundtrip(uint256 k, uint256 r)`
- [ ] `fuzz_fee_always_positive(uint256 amountIn)`

---

---

## Part 4 — Periphery

> `contracts/src/periphery/`
> User-facing. Pool does not depend on these.

---

### 4A — `OrbitalRouter.sol`

- [ ] Create `contracts/src/periphery/OrbitalRouter.sol`
- [ ] Store `address public immutable factory`
- [ ] Define `SwapParams` struct:
  - [ ] pool, assetIn, assetOut, amountIn, amountOutMin, recipient, deadline
- [ ] Implement `checkDeadline(uint256 deadline)` modifier
- [ ] Implement `exactInput(SwapParams calldata params)`:
  - [ ] Check deadline
  - [ ] Call pool.swap with params
  - [ ] Return amountOut
- [ ] Implement `exactOutput(SwapParams calldata params)`:
  - [ ] Check deadline
  - [ ] Binary search for amountIn that produces target amountOut
  - [ ] Revert if amountIn exceeds params.amountIn (max input)
- [ ] Implement `orbitalSwapCallback(uint256 assetIn, uint256 amountIn, bytes data)`:
  - [ ] Decode payer address from data
  - [ ] Verify msg.sender is a known pool (from factory)
  - [ ] Pull tokens from payer to pool via safeTransferFrom
- [ ] Implement `multicall(bytes[] calldata data)`:
  - [ ] Loop and delegatecall each item
  - [ ] Aggregate results

---

### 4B — `OrbitalQuoter.sol`

- [ ] Create `contracts/src/periphery/OrbitalQuoter.sol`
- [ ] Implement `quoteExactInput(address pool, uint256 assetIn, uint256 assetOut, uint256 amountIn)`:
  - [ ] Use try/catch to call pool.swap with amountOutMin = 0
  - [ ] Extract amountOut from revert data
  - [ ] Return amountOut without state change
- [ ] Implement `quoteExactOutput(address pool, uint256 assetIn, uint256 assetOut, uint256 amountOut)`:
  - [ ] Binary search for amountIn
  - [ ] Use quoteExactInput at each step
  - [ ] Return amountIn

---

### 4C — `OrbitalPositionManager.sol`

- [ ] Create `contracts/src/periphery/OrbitalPositionManager.sol`
- [ ] Inherit ERC721 from OpenZeppelin
- [ ] Store `address public immutable factory`
- [ ] Define `MintParams` struct:
  - [ ] pool, kWad, rWad, amounts[], amountsMin[], recipient, deadline
- [ ] Define `IncreaseLiquidityParams` struct:
  - [ ] tokenId, rWad, amountsMin[], deadline
- [ ] Define `DecreaseLiquidityParams` struct:
  - [ ] tokenId, rWad, amountsMin[], deadline
- [ ] Define `CollectParams` struct:
  - [ ] tokenId, recipient
- [ ] Implement `mint(MintParams)`:
  - [ ] Check deadline
  - [ ] Increment tokenId counter
  - [ ] Call pool.mint
  - [ ] Verify amounts received >= amountsMin
  - [ ] Store position data by tokenId
  - [ ] Mint ERC721 to recipient
  - [ ] Return tokenId + amounts
- [ ] Implement `increaseLiquidity(IncreaseLiquidityParams)`:
  - [ ] Require caller owns tokenId
  - [ ] Check deadline
  - [ ] Call pool.mint on existing tick
  - [ ] Update stored position data
- [ ] Implement `decreaseLiquidity(DecreaseLiquidityParams)`:
  - [ ] Require caller owns tokenId
  - [ ] Check deadline
  - [ ] Call pool.burn
  - [ ] Verify amounts >= amountsMin
  - [ ] Hold tokens in contract until collect
- [ ] Implement `collect(CollectParams)`:
  - [ ] Require caller owns tokenId
  - [ ] Call pool.collect for fees
  - [ ] Send any held tokens from decreaseLiquidity
  - [ ] Transfer all to recipient
- [ ] Implement `burn(uint256 tokenId)`:
  - [ ] Require caller owns tokenId
  - [ ] Require position.r == 0 (fully withdrawn)
  - [ ] Require tokensOwed == 0 (fully collected)
  - [ ] Burn ERC721
- [ ] Implement `positions(uint256 tokenId)` view:
  - [ ] Return all position data for display
- [ ] Implement `orbitalMintCallback(uint256[] amounts, bytes data)`:
  - [ ] Verify msg.sender is known pool
  - [ ] Pull tokens from payer to pool
- [ ] Implement `tokenURI(uint256 tokenId)`:
  - [ ] Return stub empty string for prototype
  - [ ] Or implement on-chain SVG (optional)

---

### 4D — `OrbitalDescriptor.sol`

- [ ] Create `contracts/src/periphery/OrbitalDescriptor.sol`
- [ ] Implement `tokenURI(address pool, uint256 tokenId, Position memory pos)`:
  - [ ] Generate JSON metadata
  - [ ] Include: asset names, k value, capital efficiency, interior/boundary status
  - [ ] Base64 encode
  - [ ] Return as data URI
- [ ] Mark as optional stub for prototype — return empty string if not implementing SVG

---

### Part 4 Tests — `contracts/test/OrbitalRouter.t.sol`

- [ ] Create `contracts/test/OrbitalRouter.t.sol`
- [ ] `test_exactInput_basic`
- [ ] `test_exactInput_slippage_reverts`
- [ ] `test_exactInput_deadline_expired_reverts`
- [ ] `test_exactOutput_basic`
- [ ] `test_exactOutput_max_input_exceeded_reverts`
- [ ] `test_quote_matches_actual_output`
- [ ] `test_multicall_two_swaps`

---

---

## Part 5 — Mocks

> `contracts/src/mocks/`
> Test helpers only. No auth on mint/burn.

- [ ] Create `contracts/src/mocks/MockERC20.sol`:
  - [ ] Standard ERC20
  - [ ] `mint(address to, uint256 amount)` — no auth
  - [ ] `burn(address from, uint256 amount)` — no auth
  - [ ] Constructor takes name and symbol
- [ ] Deploy instances:
  - [ ] MockUSDC — 6 decimals
  - [ ] MockUSDT — 6 decimals
  - [ ] MockDAI — 18 decimals
  - [ ] MockFRAX — 18 decimals
- [ ] Create `contracts/src/mocks/MockOrbitalSwapCallback.sol`:
  - [ ] Implements IOrbitalSwapCallback
  - [ ] Stores token approvals
  - [ ] Transfers tokens to pool on callback
- [ ] Create `contracts/src/mocks/MockOrbitalMintCallback.sol`:
  - [ ] Implements IOrbitalMintCallback
  - [ ] Transfers tokens to pool on callback

---

---

## Part 6 — Scripts

> `contracts/script/`

- [ ] Create `contracts/script/Deploy.s.sol`:
  - [ ] Deploy OrbitalFactory
  - [ ] Deploy MockUSDC, MockUSDT, MockDAI, MockFRAX
  - [ ] Create pool: 4 assets, 5bps fee
  - [ ] Deploy OrbitalRouter with factory address
  - [ ] Deploy OrbitalPositionManager with factory address
  - [ ] Deploy OrbitalQuoter
  - [ ] Write all addresses to `deployments/local.json`
  - [ ] Log all addresses to console

- [ ] Create `contracts/script/DeploySepolia.s.sol`:
  - [ ] Same as Deploy.s.sol
  - [ ] Read PRIVATE_KEY from env
  - [ ] Broadcast to Sepolia
  - [ ] Pass `--verify` flag for Etherscan
  - [ ] Write to `deployments/sepolia.json`

- [ ] Create `contracts/script/Seed.s.sol`:
  - [ ] Mint 1,000,000 of each mock token to deployer
  - [ ] Add LP1: r=400,000 k_norm=1.050 via PositionManager
  - [ ] Add LP2: r=350,000 k_norm=1.150
  - [ ] Add LP3: r=200,000 k_norm=1.275
  - [ ] Add LP4: r=50,000  k_norm=1.375
  - [ ] Execute 20 sample swaps covering all pairs
  - [ ] Log pool state after each swap
  - [ ] Assert invariant after each swap

- [ ] Create `contracts/script/SimulateDepeg.s.sol`:
  - [ ] Start from seeded pool state
  - [ ] Execute 50 increasing USDC→USDT swaps
  - [ ] Log tick crossings as they occur
  - [ ] Log capital efficiency and eff_price at each step
  - [ ] Show wider ticks staying interior longer
  - [ ] Show swap failure when all ticks hit boundary

---

---

## Part 7 — Gas Benchmarks

- [ ] Create `contracts/test/Gas.t.sol`
- [ ] `gas_swap_0_crossings_n3` — target < 150,000 gas
- [ ] `gas_swap_0_crossings_n5` — target < 180,000 gas
- [ ] `gas_swap_0_crossings_n10` — target < 250,000 gas
- [ ] `gas_swap_1_crossing_n3` — target < 250,000 gas
- [ ] `gas_swap_3_crossings_n3` — target < 450,000 gas
- [ ] `gas_mint_n3` — target < 200,000 gas
- [ ] `gas_burn_n3` — target < 150,000 gas
- [ ] `gas_collect_n3` — target < 80,000 gas
- [ ] Print all gas numbers in test output
- [ ] Assert each under its target — test fails if regression

---

---

## Part 8 — Security

- [ ] Run `slither contracts/src/` — fix all High and Medium findings
- [ ] Add `ReentrancyGuard` to all external state-changing functions in OrbitalPool
- [ ] Use `SafeTransferLib` / `TransferHelper` for all token transfers — no raw `.transfer()`
- [ ] Check: no unbounded loops in swap path
- [ ] Check: no division before multiplication anywhere
- [ ] Check: all user inputs validated before use
- [ ] Check: reentrancy lock covers entire swap execution including callback
- [ ] Check: factory validates pool does not already exist before deploy
- [ ] Check: position manager validates msg.sender owns tokenId before all mutations
- [ ] Check: Newton's method has iteration cap — cannot loop forever
- [ ] Check: tick crossing loop has iteration cap (max 10 crossings)
- [ ] Add `pause()` / `unpause()` to factory — disables createPool only
- [ ] Add protocol fee mechanism — owner can take % of swap fees
- [ ] Write `SECURITY.md` — known limitations of prototype

---

---

## Invariants The System Must Maintain

> These must hold after every single state-changing operation.

```
1.  torus_LHS == rInt²                (relative error < 1e-6)
2.  sumX == Σ reserves[i]             (exact)
3.  sumXSq == Σ reserves[i]²          (exact)
4.  rInt == Σ r of interior ticks     (exact)
5.  kBound == Σ k of boundary ticks   (exact)
6.  sBound == Σ s of boundary ticks   (exact)
7.  reserves[i] >= 0 for all i        (no negative reserves)
8.  reserves[i] <= r for all i        (no reserve exceeds radius)
```

---

## Build Order

```
Part 1  →  Math libraries + library tests
Part 2  →  Interfaces (all of them before any core contract)
Part 3  →  OrbitalPoolDeployer → OrbitalFactory → OrbitalPool
Part 4  →  OrbitalRouter → OrbitalQuoter → OrbitalPositionManager
Part 5  →  Mocks (needed for all tests above)
Part 6  →  Scripts (after contracts are fully tested)
Part 7  →  Gas benchmarks (last, after everything works)
Part 8  →  Security (last, before testnet deploy)
```

---

## Commands

```bash
# Build
forge build

# Test all
forge test -vv

# Test one file
forge test --match-path test/OrbitalPool.t.sol -vv

# Fuzz with more runs
forge test --match-test fuzz_ --fuzz-runs 10000

# Gas report
forge test --match-contract Gas -vv

# Invariant tests
forge test --match-test invariant_ --invariant-runs 1000

# Static analysis
slither contracts/src/

# Deploy local
anvil &
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545
forge script script/Seed.s.sol   --broadcast --rpc-url http://localhost:8545

# Deploy Sepolia
forge script script/DeploySepolia.s.sol \
  --broadcast --verify \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```