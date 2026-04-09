# Orbital AMM — Solidity Architecture

> Inspired by Uniswap V3. Implements the Paradigm Orbital paper.
> Reference: https://www.paradigm.xyz/2025/06/orbital

---

## File Count Overview

```
Libraries        7 files
Core contracts   3 files
Interfaces       8 files
Periphery        4 files
Mocks            6 files
Scripts          4 files
Tests            6 files
─────────────────────────
Total           38 files
```

---

## Folder Structure

```
contracts/
├── src/
│   ├── lib/               ← pure math, no state
│   ├── core/              ← trustless, minimal, no upgrades
│   ├── interfaces/        ← all interfaces
│   ├── periphery/         ← user-facing, can be upgraded
│   └── mocks/             ← test helpers only
├── test/
├── script/
├── deployments/
└── foundry.toml
```

---

## Libraries — `contracts/src/lib/`

> Pure math. No state. No storage. All `internal` functions.

---

### `FullMath.sol`

- `mulDiv(a, b, denominator)` — 512-bit multiply then divide, no overflow
- `mulDivRoundingUp(a, b, denominator)` — same but ceiling
- **Copy exactly from Uniswap V3. Do not modify.**
- Used by every other library and contract

---

### `SphereMath.sol`

- `sqrt(x)` — Babylonian integer square root
- `equalPricePoint(r, n)` — computes q = r(1 - 1/√n), reserve of each asset at equal price
- `computeAlpha(sumX, n)` — Σxᵢ / √n, parallel component of reserves
- `computeWNormSq(reserves[], n)` — Σ(xᵢ - mean)², cancellation-safe form (not Σxᵢ² - mean²)
- `spotPrice(r, xi, xj)` — (r - xⱼ) / (r - xᵢ) in WAD
- `checkSphereInvariant(sumX, sumXSq, r, n)` — verifies ||r_vec - x_vec||² == r²

---

### `TorusMath.sol`

- `TorusState` struct — holds rInt, kBound, sBound, sumX, sumXSq, n
- `torusLHS(state)` — computes full left side of torus invariant
- `checkInvariant(state)` — relative tolerance check, returns (bool ok, uint256 relativeDrift)
- `solveSwap(state, assetIn, assetOut, amountIn, reserves[])` — Newton's method, 15 iterations
- `computeS(r, k, n)` — boundary radius √(r² - (k - r√n)²)
- `alphaNorm(alphaInt, rInt)` — normalized alpha for tick crossing detection

---

### `TickLib.sol`

- `Tick` struct — k, r, isInterior, feeGrowthInside, liquidityGross
- `kMin(r, n)` — minimum valid k = r(√n - 1)
- `kMax(r, n)` — maximum valid k = r(n-1)/√n
- `kFromDepegPrice(r, n, pWad)` — given target depeg price, return matching k
- `capitalEfficiency(r, n, k)` — xBase / (xBase - xMin), returned in WAD
- `xMin(r, n, k)` — minimum reserve per asset on this tick
- `xMax(r, n, k)` — maximum reserve per asset on this tick
- `boundaryRadius(r, k, n)` — s value for this tick

---

### `PositionLib.sol`

- `Position` struct — tickIndex, r, feeGrowthInsideLast, tokensOwed
- `positionKey(owner, tickIndex)` — returns keccak256 key
- `updateFees(position, feeGrowthGlobal)` — compute uncollected fees since last update
- `get(positions, owner, tickIndex)` — retrieve position by key

---

### `OrbitalOracle.sol`

- `Observation` struct — timestamp, sumX, sumXSq, initialized
- `observations[]` — ring buffer, 65535 slots (same size as Uniswap V3)
- `write(observations, index, blockTimestamp, sumX, sumXSq, cardinality, cardinalityNext)` — record new observation
- `observe(observations, time, secondsAgos[], sumX, sumXSq, index, cardinality)` — return TWAP over time range
- `transform(last, blockTimestamp, sumX, sumXSq)` — compute cumulative values from current state
- `grow(observations, current, next)` — expand observations array

---

### `TransferHelper.sol`

- `safeTransfer(token, to, value)`
- `safeTransferFrom(token, from, to, value)`
- `safeApprove(token, spender, value)`
- **Copy from Uniswap V3. Do not modify.**

---

## Core Contracts — `contracts/src/core/`

> Trustless and minimal. No proxy, no upgrade, no owner after deploy.

---

### `OrbitalFactory.sol`

- `createPool(address[] tokens, uint24 fee)` — deploys new OrbitalPool, returns address
- `getPool` mapping — tokenSetHash → pool address
- `allPools[]` — list of all deployed pools
- `owner` — can enable new fee tiers only
- `feeAmountEnabled` mapping — which fee tiers are valid
- `PoolCreated` event — tokens, fee, pool address

---

### `OrbitalPoolDeployer.sol`

- `Parameters` struct — factory, tokens[], fee
- `deploy(factory, tokens[], fee)` — called only by factory
- Stores constructor params temporarily so pool can read them
- Same pattern as Uniswap V3 to avoid constructor bytecode size limit

---

### `OrbitalPool.sol`

**Immutables (set once, never change)**
- `factory` — factory address
- `tokens[]` — stablecoin addresses
- `n` — number of assets
- `fee` — fee tier in hundredths of a bip

**Slot0 (hot path, read every swap)**
- `sumX` — Σxᵢ total reserves
- `sumXSq` — Σxᵢ² total reserves
- `rInt` — consolidated interior radius
- `kBound` — Σk of all boundary ticks
- `sBound` — Σs of all boundary ticks
- `unlocked` — reentrancy lock

**Storage**
- `reserves` mapping — assetIndex → amount
- `feeGrowthGlobal` — fees per unit r, WAD scaled
- `ticks[]` — all registered ticks sorted by k ascending
- `positions` mapping — bytes32 key → Position

**External functions**
- `mint(recipient, kWad, rWad, data)` — add liquidity at tick k, returns amounts[]
- `swap(recipient, assetIn, assetOut, amountIn, amountOutMin, data)` — returns amountOut
- `burn(tickIndex, rWad)` — remove liquidity, returns amounts[]
- `collect(tickIndex)` — collect accumulated fees
- `observe(secondsAgos[])` — TWAP oracle read
- `increaseObservationCardinalityNext(next)` — expand oracle ring buffer

**Internal functions**
- `_solveWithCrossings(...)` — main swap loop, handles multiple tick crossings
- `_crossTick(tickIdx, state)` — flip tick interior/boundary, update rInt/kBound/sBound
- `_detectCrossing(rInt, alphaNormNew)` — check if alpha_norm crossed any k_norm boundary
- `_tradeToXover(...)` — trade exactly to crossing point using quadratic formula
- `_accumulateFee(feeAmount)` — update feeGrowthGlobal
- `_updatePositionFees(position)` — compute fees owed since last update
- `_buildTorusState()` — assemble TorusState struct from slot0
- `_updateReserves(assetIn, assetOut, amountIn, amountOut)` — update sumX, sumXSq, reserves

**Events**
- `Swap` — sender, recipient, assetIn, assetOut, amountIn, amountOut
- `Mint` — recipient, kWad, rWad, amounts[]
- `Burn` — owner, tickIndex, rWad, amounts[]
- `Collect` — owner, tickIndex, fees[]
- `TickCrossed` — tickIndex, newIsInterior

**Modifiers**
- `lock` — reentrancy using slot0.unlocked

---

## Interfaces — `contracts/src/interfaces/`

---

### `IOrbitalFactory.sol`
- `createPool` signature
- `getPool` getter
- `PoolCreated` event

### `IOrbitalPool.sol`
- Inherits all pool interfaces below

### `IOrbitalPoolState.sol`
- All public state variable getters
- slot0, reserves, feeGrowthGlobal, ticks, positions
- factory, tokens, n, fee

### `IOrbitalPoolActions.sol`
- mint, swap, burn, collect signatures with full NatSpec

### `IOrbitalPoolEvents.sol`
- All events: Swap, Mint, Burn, Collect, TickCrossed

### `IOrbitalPoolOwnerActions.sol`
- `setFeeProtocol(uint8)` — take cut of fees for protocol
- `collectProtocol(address recipient)` — withdraw protocol fees

### `IOrbitalMintCallback.sol`
- `orbitalMintCallback(uint256[] amounts, bytes data)`
- Called by pool during mint to pull tokens from LP

### `IOrbitalSwapCallback.sol`
- `orbitalSwapCallback(uint256 assetIn, uint256 amountIn, bytes data)`
- Called by pool during swap to pull tokens from trader

---

## Periphery — `contracts/src/periphery/`

> User-facing. Can be replaced or upgraded. Pool does not depend on these.

---

### `OrbitalRouter.sol`

- `SwapParams` struct — pool, assetIn, assetOut, amountIn, amountOutMin, recipient, deadline
- `exactInput(SwapParams)` — exact input amount, minimum output enforced
- `exactOutput(SwapParams)` — exact output amount, maximum input enforced
- `checkDeadline` modifier — reverts if block.timestamp > deadline
- `orbitalSwapCallback` — pulls input tokens from payer on behalf of pool
- `multicall` support — batch multiple calls in one transaction

---

### `OrbitalQuoter.sol`

- `quoteExactInput(pool, assetIn, assetOut, amountIn)` — returns expected amountOut
- `quoteExactOutput(pool, assetIn, assetOut, amountOut)` — returns required amountIn
- Uses try/catch revert pattern — same as Uniswap V3 Quoter
- Not a view function — uses revert to extract return values
- No state changes despite not being view

---

### `OrbitalPositionManager.sol`

- Inherits ERC721 — each LP position is an NFT
- `MintParams` struct — pool, kWad, rWad, amounts[], amountsMins[], recipient, deadline
- `IncreaseLiquidityParams` struct — tokenId, rWad, amountsMin[], deadline
- `DecreaseLiquidityParams` struct — tokenId, rWad, amountsMin[], deadline
- `CollectParams` struct — tokenId, recipient
- `mint(MintParams)` — creates position, mints NFT, returns tokenId + amounts
- `increaseLiquidity(IncreaseLiquidityParams)` — add more r to existing position
- `decreaseLiquidity(DecreaseLiquidityParams)` — reduce r, tokens held in contract until collect
- `collect(CollectParams)` — withdraw tokens and fees from position
- `burn(tokenId)` — destroy NFT after full withdrawal
- `positions(tokenId)` — read all position data for a given NFT
- `orbitalMintCallback` — pulls tokens from LP during mint
- `tokenURI` — returns on-chain SVG metadata (stub for prototype)

---

### `OrbitalDescriptor.sol`

- `tokenURI(pool, tokenId, position)` — generate on-chain SVG for position NFT
- Shows: assets, k value, capital efficiency, current status (interior/boundary)
- Optional for prototype — include as stub returning empty string

---

## Mocks — `contracts/src/mocks/`

> Testnet and test use only. Never deploy to mainnet.

---

### `MockERC20.sol`
- Standard ERC20
- `mint(address to, uint256 amount)` — no auth
- `burn(address from, uint256 amount)` — no auth
- Deploy one instance per stablecoin: MockUSDC, MockUSDT, MockDAI, MockFRAX

### `MockOrbitalSwapCallback.sol`
- Implements `IOrbitalSwapCallback`
- Approves and transfers tokens to pool on callback
- Used in pool tests to simulate router behavior

### `MockOrbitalMintCallback.sol`
- Implements `IOrbitalMintCallback`
- Approves and transfers tokens to pool on callback
- Used in pool tests to simulate LP deposit

---

## Scripts — `contracts/script/`

---

### `Deploy.s.sol`
- Deploy OrbitalFactory
- Deploy MockUSDC, MockUSDT, MockDAI, MockFRAX
- Create pool via factory (4 assets, 5bps fee)
- Deploy OrbitalRouter
- Deploy OrbitalPositionManager
- Deploy OrbitalQuoter
- Write all addresses to `deployments/local.json`

### `DeploySepolia.s.sol`
- Same as Deploy.s.sol
- Reads PRIVATE_KEY and RPC_URL from .env
- Broadcasts to Sepolia
- Verifies all contracts on Etherscan
- Writes to `deployments/sepolia.json`

### `Seed.s.sol`
- Mint 1,000,000 of each mock token to deployer
- Add 4 LP positions:
  - LP1: r=400,000 k_norm=1.050 (tight, 2x efficient)
  - LP2: r=350,000 k_norm=1.150 (medium, 1.3x efficient)
  - LP3: r=200,000 k_norm=1.275 (wide, 1.1x efficient)
  - LP4: r=50,000  k_norm=1.375 (backstop, 1.0x)
- Execute 20 sample swaps across all asset pairs
- Assert invariant holds after each swap

### `SimulateDepeg.s.sol`
- Starting from seeded pool
- Execute 50 one-directional USDC swaps increasing in size
- Log each tick crossing with before/after rInt
- Log capital efficiency and slippage at each step
- Show boundary tick pinning behavior
- Demonstrate wider ticks staying interior longer than tight ticks

---

## Tests — `contracts/test/`

---

### `SphereMath.t.sol`
- `test_sqrt_known_values` — sqrt(4)=2, sqrt(9)=3, sqrt(1e18)=1e9
- `test_equalPricePoint_n2_n3_n4_n5` — verify q formula for each n
- `test_spotPrice_at_equal_price_is_one` — all pairwise prices = 1 at q
- `test_wNormSq_zero_at_equal_price` — ||w||² = 0 when all reserves equal
- `test_computeAlpha_at_equal_price` — alpha = r at equal-price point
- `fuzz_sqrt_floor(uint256 x)` — sqrt(x)² ≤ x always

### `TorusMath.t.sol`
- `test_torusLHS_at_equal_price_equals_rSq` — LHS = r² at q
- `test_checkInvariant_good_state` — returns true for valid state
- `test_checkInvariant_bad_state` — returns false for corrupted state
- `test_solveSwap_output_positive` — amountOut > 0 for valid input
- `test_solveSwap_invariant_holds_after` — checkInvariant true post-swap
- `test_computeS_leq_r` — s ≤ r always
- `test_alphaNorm_one_at_equal_price` — alphaNorm = 1.0 WAD at q
- `fuzz_checkInvariant_after_swap(uint256 amountIn)` — invariant holds for any swap size

### `TickLib.t.sol`
- `test_kMin_lt_kMax` — for all n, kMin < kMax
- `test_kFromDepegPrice_099_is_tight` — gives small k close to kMin
- `test_kFromDepegPrice_000_is_kMax` — p=0 returns kMax
- `test_capitalEfficiency_gt_one_for_k_lt_kMax` — eff > 1x
- `test_capitalEfficiency_one_at_kMax` — eff = 1x at max boundary
- `test_xMin_lt_xBase` — xMin < xBase always
- `fuzz_xMin_leq_xBase(uint256 k)` — fuzz over k range

### `OrbitalPool.t.sol`
- `test_mint_initializes_reserves_correctly`
- `test_mint_at_equal_price_point`
- `test_mint_mid_session_imbalanced_pool`
- `test_swap_basic_small` — 0.1% of pool, invariant holds
- `test_swap_medium` — 1% of pool
- `test_swap_large` — 5% of pool
- `test_swap_symmetry` — swap A→B then B→A returns near original
- `test_swap_price_impact_increases_with_size`
- `test_swap_tick_crossing_one` — single boundary crossed cleanly
- `test_swap_tick_crossing_multiple` — three crossings, invariant holds throughout
- `test_swap_fails_no_liquidity` — reverts when rInt = 0
- `test_swap_slippage_protection` — reverts when output < amountOutMin
- `test_burn_returns_proportional_amounts`
- `test_collect_fees_after_100_swaps`
- `test_depeg_scenario_50_swaps` — one-directional pressure, tick crossings
- `invariant_sumX_matches_sum_of_reserves` — Foundry invariant test
- `invariant_torus_always_holds` — Foundry invariant test
- `fuzz_swap_invariant(uint256 amountIn, uint8 assetIn, uint8 assetOut)`
- `fuzz_mint_burn_roundtrip(uint256 k, uint256 r)`

### `OrbitalRouter.t.sol`
- `test_exactInput_basic`
- `test_exactInput_slippage_reverts`
- `test_exactInput_deadline_expired_reverts`
- `test_exactOutput_basic`
- `test_exactOutput_max_input_reverts`
- `test_quote_matches_actual_output`

### `Gas.t.sol`
- `gas_swap_0_crossings_n3` — target < 150k gas
- `gas_swap_0_crossings_n5` — target < 180k gas
- `gas_swap_0_crossings_n10` — target < 250k gas
- `gas_swap_1_crossing_n3` — target < 250k gas
- `gas_swap_3_crossings_n3` — target < 450k gas
- `gas_mint_n3`
- `gas_burn_n3`
- `gas_collect_n3`
- Print all results, assert each under target

---

## Uniswap V3 → Orbital Mapping

| Uniswap V3 | Orbital | Notes |
|---|---|---|
| `UniswapV3Factory` | `OrbitalFactory` | same pattern |
| `UniswapV3Pool` | `OrbitalPool` | sphere + torus instead of xy=k |
| `SwapRouter` | `OrbitalRouter` | assets are indices not addresses |
| `NonfungiblePositionManager` | `OrbitalPositionManager` | same ERC721 pattern |
| `Quoter` | `OrbitalQuoter` | same try/catch revert pattern |
| `TickMath` | `SphereMath` | sphere geometry instead of log ticks |
| `SqrtPriceMath` | `TorusMath` | torus invariant instead of sqrt price |
| `LiquidityMath` | `TickLib` | k/r system instead of tick spacing |
| `FullMath` | `FullMath` | identical, copy from V3 |
| `Oracle` | `OrbitalOracle` | sumX/sumXSq TWAP instead of price TWAP |
| `TransferHelper` | `TransferHelper` | identical, copy from V3 |
| `sqrtPriceX96` (Q64.96) | `sumX + sumXSq` (WAD) | different state representation |
| `liquidity` (uint128) | `rInt` (WAD uint256) | consolidated interior radius |
| tick (int24 log bucket) | tick (k plane constant WAD) | nested not disjoint |
| 2 assets only | N assets | main difference |

---

## Key Invariants The System Must Maintain

```
At all times:
  1. torus_LHS == rInt²               (relative error < 1e-6)
  2. sumX == Σ reserves[i]            (exact)
  3. sumXSq == Σ reserves[i]²         (exact)
  4. rInt == Σ r of interior ticks    (exact)
  5. kBound == Σ k of boundary ticks  (exact)
  6. sBound == Σ s of boundary ticks  (exact)
  7. reserves[i] >= 0 for all i       (no negative reserves)
  8. reserves[i] <= r for all i       (no reserve exceeds radius)
```

---

## Precision

```
All values:         WAD (1e18 scaled uint256)
Intermediate mul:   FullMath.mulDiv (512-bit, no overflow)
||w||² formula:     Σ(xᵢ - mean)² not Σxᵢ² - mean²  (avoids cancellation)
Newton tolerance:   step < 2 wei  (converges in ~5 iterations)
Invariant check:    relative drift < 1e-6 (1000x above expected noise)
Python reference:   Decimal(78), ROUND_DOWN  (matches Solidity truncation)
```

---

## Quick Start

```bash
# Install
forge install

# Test
forge test -vv

# Gas report
forge test --match-contract Gas -vv

# Deploy local
anvil &
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545

# Seed local
forge script script/Seed.s.sol --broadcast --rpc-url http://localhost:8545

# Deploy Sepolia
forge script script/DeploySepolia.s.sol --broadcast --verify \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```

---

## Environment Variables

```bash
# .env
PRIVATE_KEY=
SEPOLIA_RPC_URL=
ETHERSCAN_API_KEY=
```