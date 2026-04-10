# Orbital AMM — Contracts TODO

> Folder: `contracts/`
> Framework: Foundry
> Reference: https://www.paradigm.xyz/2025/06/orbital

---

## Setup

- [x] Run `forge init contracts/`
- [ ] Install deps: `forge install transmissions11/solmate` *(not installed — unused so far)*
- [ ] Install deps: `forge install PaulRBerg/prb-math` *(not installed — unused so far)*
- [x] Install deps: `forge install OpenZeppelin/openzeppelin-contracts` *(not installed — unused so far)*
- [x] Install deps: `forge install Uniswap/v3-core` *(not installed — FullMath/TransferHelper copied manually)*
- [x] Configure `foundry.toml`:
  - [x] solc version `0.8.24`
  - [x] optimizer runs `200`
  - [x] `via_ir = true`
- [x] Create folder `contracts/src/lib/`
- [x] Create folder `contracts/src/core/`
- [x] Create folder `contracts/src/interfaces/`
- [x] Create folder `contracts/src/periphery/`
- [x] Create folder `contracts/src/mocks/`
- [x] Create folder `contracts/test/`
- [x] Create folder `contracts/script/`
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

- [x] Create `contracts/src/lib/SphereMath.sol`
- [x] Define `uint256 constant WAD = 1e18`
- [x] Define `uint256 constant WAD2 = 1e36`
- [x] Implement `sqrt(uint256 x)`:
  - [x] Babylonian integer method
  - [x] Returns floor of square root
  - [x] Handles x = 0 edge case
- [x] Implement `equalPricePoint(uint256 r, uint256 n)`:
  - [x] Formula: q = r(1 - 1/√n)
  - [x] Returns WAD-scaled result
- [x] Implement `computeAlpha(uint256 sumX, uint256 n)`:
  - [x] Formula: Σxᵢ / √n
  - [x] Use FullMath.mulDiv for division
- [x] Implement `computeWNormSq(uint256[] reserves, uint256 n)`:
  - [x] Formula: Σ(xᵢ - mean)² — cancellation-safe
  - [x] Do NOT use Σxᵢ² - (Σxᵢ)²/n — catastrophic cancellation
  - [x] Use FullMath.mulDiv for each squared term
- [x] Implement `spotPrice(uint256 r, uint256 xi, uint256 xj)`:
  - [x] Formula: (r - xⱼ) / (r - xᵢ) in WAD
  - [x] Require r > xj and r > xi
  - [x] Use FullMath.mulDiv
- [x] Implement `checkSphereInvariant(uint256 sumX, uint256 sumXSq, uint256 r, uint256 n)`:
  - [x] Compute ||r_vec - x_vec||² = nr² - 2rΣxᵢ + Σxᵢ²
  - [x] Compare to r² with relative tolerance
  - [x] Tolerance: relative drift < 1e-6 (drift * 1e6 < rhs)

---

### 1C — `TickLib.sol`

> Tick geometry from paper Section 4.5, 4.6, 4.7, 4.8, 4.9

- [x] Create `contracts/src/lib/TickLib.sol`
- [x] Define `Tick` struct:
  - [x] `uint256 k` — plane constant in WAD
  - [x] `uint256 r` — radius contribution in WAD
  - [x] `bool isInterior` — current status
  - [x] `uint256 feeGrowthInside` — fee tracker
  - [x] `uint128 liquidityGross` — total r in integer units
- [x] Implement `kMin(uint256 r, uint256 n)`:
  - [x] Formula: r(√n - 1) in WAD
- [x] Implement `kMax(uint256 r, uint256 n)`:
  - [x] Formula: r(n-1)/√n in WAD
- [x] Implement `kFromDepegPrice(uint256 r, uint256 n, uint256 pWad)`:
  - [x] Formula from paper Section 4.8
  - [x] k = r√n - r(p + n-1) / √(n(p² + n-1))
  - [x] pWad = depeg price in WAD (e.g. 0.99e18)
- [x] Implement `capitalEfficiency(uint256 r, uint256 n, uint256 k)`:
  - [x] Formula: xBase / (xBase - xMin) in WAD
  - [x] Returns 1e18 (1x) if k = kMax
- [x] Implement `xMin(uint256 r, uint256 n, uint256 k)` (internal):
  - [x] Formula from paper Section 4.7
  - [x] xMin = (k√n - √(k²n - n((n-1)r - k√n)²)) / n
- [x] Implement `xMax(uint256 r, uint256 n, uint256 k)` (internal):
  - [x] Same formula but + instead of - before sqrt
  - [x] Cap at r: return min(computed, r)
- [x] Implement `boundaryRadius(uint256 r, uint256 k, uint256 n)`:
  - [x] Formula: s = √(r² - (k - r√n)²)
  - [x] Require k in valid range

---

### 1D — `TorusMath.sol`

> Global torus invariant from paper Section 4.11, 4.12, 4.13

- [x] Create `contracts/src/lib/TorusMath.sol`
- [x] Define `TorusState` struct:
  - [x] `uint256 rInt` — consolidated interior radius
  - [x] `uint256 kBound` — Σk of all boundary ticks
  - [x] `uint256 sBound` — Σs of all boundary ticks
  - [x] `uint256 sumX` — Σxᵢ total reserves
  - [x] `uint256 sumXSq` — Σxᵢ² total reserves
  - [x] `uint256 n` — number of assets
- [x] Implement `torusLHS(TorusState memory s)`:
  - [x] Compute alphaTot = sumX / √n
  - [x] Compute alphaInt = alphaTot - kBound
  - [x] Compute rIntSqrtN = rInt * √n
  - [x] term1 = |alphaInt - rIntSqrtN|
  - [x] Compute wNorm from sumX and sumXSq
  - [x] term2 = |wNorm - sBound|
  - [x] Return term1² + term2²
- [x] Implement `checkInvariant(TorusState memory s)`:
  - [x] Compute lhs = torusLHS(s)
  - [x] Compute rhs = rInt²
  - [x] Handle rhs = 0 edge case (all ticks on boundary)
  - [x] Return (bool ok, uint256 relativeDrift)
  - [x] Relative drift = |lhs - rhs| / rhs
  - [x] ok = relativeDrift < 1e12 (1e-6 in WAD)
- [x] Implement `solveSwap(TorusState memory s, uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256[] memory reserves)`:
  - [x] Update sumX and sumXSq for input side first
  - [x] Initial guess: amountOut = amountIn * 999 / 1000
  - [x] Loop 15 iterations of Newton's method
  - [x] Convergence: break when step < 2 wei
  - [x] Return amountOut
- [x] Implement `computeS(uint256 r, uint256 k, uint256 n)`:
  - [x] Formula: √(r² - (k - r√n)²)
  - [x] Require r² >= (k - r√n)²
- [x] Implement `alphaNorm(uint256 alphaInt, uint256 rInt)`:
  - [x] Return alphaInt * WAD / rInt
  - [x] Return type(uint256).max if rInt = 0

---

### 1E — `PositionLib.sol`

> LP position tracking, mirrors Uniswap V3 Position.sol

- [x] Create `contracts/src/lib/PositionLib.sol`
- [x] Define `Position` struct:
  - [x] `uint256 tickIndex`
  - [x] `uint256 r`
  - [ ] `uint256 feeGrowthInsideLast` *(moved to pool-level mapping `feeGrowthInsideLast[pKey][assetIndex]` — n-asset generalisation)*
  - [ ] `uint128 tokensOwed` *(moved to pool-level mapping `tokensOwed[pKey][assetIndex]`)*
- [x] Implement `positionKey(address owner, uint256 tickIndex)`:
  - [x] Return keccak256(abi.encodePacked(owner, tickIndex))
- [x] Implement `get(mapping(bytes32 => Position) storage, address owner, uint256 tickIndex)`:
  - [x] Return position by key
- [ ] Implement `updateFees(Position storage pos, uint256 feeGrowthGlobal)` *(implemented as `_updatePositionFees(pKey, posR)` in OrbitalPool — handles n assets)*

---

### 1F — `OrbitalOracle.sol`

> TWAP oracle, mirrors Uniswap V3 Oracle.sol

- [x] Create `contracts/src/lib/OrbitalOracle.sol`
- [x] Define `Observation` struct:
  - [x] `uint32 blockTimestamp`
  - [x] `uint256 cumulativeSumX` — time-weighted sumX
  - [x] `uint256 cumulativeSumXSq` — time-weighted sumXSq
  - [x] `bool initialized`
- [x] Implement `initialize(Observation[65535] storage, uint32 time, uint256 sumX, uint256 sumXSq)`:
  - [x] Write first observation at index 0 *(note: sig is `initialize(self, time)` — cumulative start at 0)*
- [x] Implement `write(observations, index, blockTimestamp, sumX, sumXSq, cardinality, cardinalityNext)`:
  - [x] Skip if same block as last observation
  - [x] Write new observation at next index
  - [x] Return new index and cardinality
- [x] Implement `transform(Observation memory last, uint32 blockTimestamp, uint256 sumX, uint256 sumXSq)`:
  - [x] Compute cumulative values from last observation to now
- [x] Implement `observe(observations, time, secondsAgos[], sumX, sumXSq, index, cardinality)`:
  - [x] Binary search for target timestamp
  - [x] Interpolate between observations
  - [x] Return cumulativeSumX[], cumulativeSumXSq[]
- [x] Implement `grow(observations, current, next)`:
  - [x] Initialize new slots up to `next`
  - [x] Return new cardinality

---

### Part 1 Tests — `contracts/test/SphereMath.t.sol`

- [x] Create `contracts/test/SphereMath.t.sol`
- [x] `test_sqrt_zero` — sqrt(0) = 0
- [x] `test_sqrt_perfect_squares` — sqrt(4), sqrt(9), sqrt(16), sqrt(1e18)
- [x] `test_sqrt_floor` — sqrt(x)² ≤ x always
- [x] `test_equalPricePoint_n2` — verify formula for n=2
- [x] `test_equalPricePoint_n3` — verify for n=3
- [x] `test_equalPricePoint_n4` — verify for n=4
- [x] `test_spotPrice_at_equal_price_is_one` — price = 1.0 when xᵢ = xⱼ
- [x] `test_spotPrice_directional` — adding xᵢ makes asset i cheaper
- [x] `test_wNormSq_zero_at_equal_price` — ||w||² = 0 when all equal
- [x] `test_wNormSq_nonzero_after_imbalance`
- [x] `test_sphereInvariant_holds_at_equalPrice`
- [x] `fuzz_sqrt(uint256 x)` — sqrt(x)² ≤ x always

### Part 1 Tests — `contracts/test/TickLib.t.sol`

- [x] Create `contracts/test/TickLib.t.sol`
- [x] `test_kMin_lt_kMax_n2` through `test_kMin_lt_kMax_n10`
- [x] `test_kFromDepegPrice_099` — tight tick near kMin
- [x] `test_kFromDepegPrice_090` — wide tick
- [x] `test_kFromDepegPrice_000` — returns kMax
- [x] `test_capitalEfficiency_gt_one_below_kMax`
- [x] `test_capitalEfficiency_one_at_kMax`
- [x] `test_xMin_lt_xBase` — xMin < equal price point reserve
- [x] `test_boundaryRadius_leq_r` — s ≤ r always
- [x] `fuzz_kFromDepegPrice(uint256 p)` — result always in [kMin, kMax]

### Part 1 Tests — `contracts/test/TorusMath.t.sol`

- [x] Create `contracts/test/TorusMath.t.sol`
- [x] `test_torusLHS_at_equal_price_equals_rIntSq`
- [x] `test_checkInvariant_valid_state_returns_true`
- [x] `test_checkInvariant_corrupted_state_returns_false`
- [x] `test_solveSwap_output_positive`
- [x] `test_solveSwap_invariant_holds_after`
- [x] `test_solveSwap_symmetry` — swap A→B then B→A ≈ original
- [x] `test_computeS_leq_r`
- [x] `test_alphaNorm_one_at_equal_price`
- [x] `test_alphaNorm_max_when_rInt_zero`
- [x] `fuzz_solveSwap_invariant(uint256 amountIn)` — invariant holds for any size

---

---

## Part 2 — Interfaces

> `contracts/src/interfaces/`
> Declare everything before implementing. No logic here.

- [x] Create `contracts/src/interfaces/IOrbitalFactory.sol`:
  - [x] `createPool(address[] tokens, uint24 fee)` returns address
  - [x] `getPool(bytes32 tokenSetHash)` returns address
  - [x] `owner()` returns address
  - [x] `PoolCreated` event
- [x] Create `contracts/src/interfaces/IOrbitalPoolState.sol`:
  - [x] `factory()`, `tokens(uint256)`, `n()`, `fee()`
  - [x] `slot0()` — returns sumX, sumXSq, rInt, kBound, sBound, unlocked
  - [x] `reserves(uint256 assetIndex)` returns uint256
  - [x] `feeGrowthGlobal()` returns uint256
  - [x] `ticks(uint256 index)` returns Tick struct
  - [x] `positions(bytes32 key)` returns Position struct
- [x] Create `contracts/src/interfaces/IOrbitalPoolActions.sol`:
  - [x] `mint(address recipient, uint256 kWad, uint256 rWad, bytes data)` returns uint256[] amounts
  - [x] `swap(address recipient, uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256 amountOutMin, bytes data)` returns uint256 amountOut
  - [x] `burn(uint256 tickIndex, uint256 rWad)` returns uint256[] amounts
  - [x] `collect(uint256 tickIndex)` returns uint256[] fees
- [x] Create `contracts/src/interfaces/IOrbitalPoolEvents.sol`:
  - [x] `Mint(address recipient, uint256 kWad, uint256 rWad, uint256[] amounts)`
  - [x] `Swap(address sender, address recipient, uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256 amountOut)`
  - [x] `Burn(address owner, uint256 tickIndex, uint256 rWad, uint256[] amounts)`
  - [x] `Collect(address owner, uint256 tickIndex, uint256[] fees)`
  - [x] `TickCrossed(uint256 tickIndex, bool newIsInterior)`
- [x] Create `contracts/src/interfaces/IOrbitalPoolOwnerActions.sol`:
  - [x] `setFeeProtocol(uint8 feeProtocol)`
  - [x] `collectProtocol(address recipient)` returns uint256[] fees
- [x] Create `contracts/src/interfaces/IOrbitalPool.sol`:
  - [x] Inherits all pool interfaces above
- [x] Create `contracts/src/interfaces/IOrbitalMintCallback.sol`:
  - [x] `orbitalMintCallback(uint256[] amounts, bytes data)`
- [x] Create `contracts/src/interfaces/IOrbitalSwapCallback.sol`:
  - [x] `orbitalSwapCallback(uint256 assetIn, uint256 amountIn, bytes data)`

---

---

## Part 3 — Core Contracts

> `contracts/src/core/`
> The trustless heart of the system. No upgrades. No proxies.

---

### 3A — `OrbitalPoolDeployer.sol`

- [x] Create `contracts/src/core/OrbitalPoolDeployer.sol`
- [x] Define `Parameters` struct — factory, tokens[], fee
- [x] Store parameters in contract storage temporarily
- [x] Implement `deploy(factory, tokens[], fee)`:
  - [x] Set parameters in storage
  - [x] Deploy new OrbitalPool via `new OrbitalPool{salt: salt}()`
  - [x] Clear parameters from storage after deploy
  - [x] Return deployed pool address
- [x] Only callable by factory (`_deploy` is `internal`)

---

### 3B — `OrbitalFactory.sol`

- [x] Create `contracts/src/core/OrbitalFactory.sol`
- [x] Inherits OrbitalPoolDeployer
- [x] Storage:
  - [x] `address public owner`
  - [x] `mapping(bytes32 => address) public getPool`
  - [x] `address[] public allPools`
  - [x] `mapping(uint24 => bool) public feeAmountEnabled`
- [x] Constructor:
  - [x] Set owner = msg.sender
  - [x] Enable default fee tiers: 100, 500, 3000, 10000
- [x] Implement `createPool(address[] tokens, uint24 fee)`:
  - [x] Require fee is enabled
  - [x] Require tokens.length >= 2
  - [x] Require all token addresses are valid and unique
  - [x] Compute tokenSetHash = keccak256(sorted token addresses + fee)
  - [x] Require pool does not already exist
  - [x] Deploy via OrbitalPoolDeployer.deploy
  - [x] Store in getPool mapping and allPools array
  - [x] Emit PoolCreated
- [x] Implement `enableFeeAmount(uint24 fee)`:
  - [x] Only owner
  - [x] Add to feeAmountEnabled
- [x] Implement `setOwner(address newOwner)`:
  - [x] Only current owner
  - [x] Two-step transfer pattern (`setOwner` + `acceptOwner`)

---

### 3C — `OrbitalPool.sol`

> The main contract. Implement feature by feature.

- [x] Create `contracts/src/core/OrbitalPool.sol`

**3C-1 Storage and constructor**
- [x] Declare all imports (FullMath, SphereMath, TorusMath, TickLib, PositionLib, OrbitalOracle)
- [x] Declare immutables: factory, tokens[], n, fee
- [x] Declare Slot0 struct and `slot0` variable
- [x] Declare `reserves` mapping
- [x] Declare `feeGrowthGlobal`
- [x] Declare `ticks` array and `numTicks`
- [x] Declare `positions` mapping
- [x] Declare oracle observations array
- [x] Implement constructor — read from OrbitalPoolDeployer.parameters
- [x] Implement `lock` modifier using slot0.unlocked

**3C-2 Mint (add liquidity)**
- [x] Implement `mint(recipient, kWad, rWad, data)`:
  - [x] Validate k is in [kMin, kMax] range
  - [x] Validate rWad > 0
  - [x] Compute deposit amounts based on current pool state
  - [x] If pool is at equal-price point: deposit q per asset minus virtual
  - [x] If pool is imbalanced: deposit at current reserve ratios
  - [x] Insert tick into ticks array (sorted by k)
  - [x] Update slot0.rInt += rWad
  - [x] Update slot0.sumX and slot0.sumXSq
  - [x] Update reserves[]
  - [x] Store Position in positions mapping
  - [x] Call IOrbitalMintCallback to pull tokens
  - [x] Verify tokens were received
  - [x] Assert invariant holds after mint
  - [x] Emit Mint event

**3C-3 Swap (core feature)**
- [x] Implement `swap(recipient, assetIn, assetOut, amountIn, amountOutMin, data)`:
  - [x] Validate inputs (nonzero, valid indices, different assets)
  - [x] Require rInt > 0
  - [x] Compute fee: feeAmount = amountIn * fee / 1_000_000
  - [x] amountInNet = amountIn - feeAmount
  - [x] Call `_accumulateFee(feeAmount)`
  - [x] Call `_solveWithCrossings(...)` to get amountOut
  - [x] Require amountOut >= amountOutMin
  - [x] Require amountOut > 0
  - [x] Call `_updateReserves(assetIn, assetOut, amountInNet, amountOut)`
  - [x] Transfer output tokens to recipient
  - [x] Call IOrbitalSwapCallback to pull input tokens
  - [x] Verify input tokens were received
  - [x] Write oracle observation
  - [x] Assert invariant holds after swap
  - [x] Emit Swap event
- [x] Implement `_solveWithCrossings(state, res, assetIn, assetOut, amountIn)`:
  - [x] Loop up to 10 iterations (max tick crossings)
  - [x] Each iteration: attempt full trade with current torus state
  - [x] Call `_detectCrossing(rInt, alphaNormNew)` to check
  - [x] If no crossing: accept result, exit loop
  - [x] If crossing: call `_tradeToXover(...)` for partial trade
  - [x] Call `_crossTick(tickIdx, state)` to update params
  - [x] Continue loop with remaining amount
- [x] Implement `_detectCrossing(rInt, alphaNormNew)`:
  - [x] Loop through all ticks
  - [x] Interior tick: crossing if alphaNormNew > tick.kNorm
  - [x] Boundary tick: crossing if alphaNormNew < tick.kNorm
  - [x] Return (bool crossed, uint256 crossingTickIdx)
- [x] Implement `_tradeToXover(state, res, assetIn, assetOut, remaining, crossTickIdx)`:
  - [x] Compute target alphaTotal at crossing point
  - [x] alphaXover = rInt * kNorm_crossing + kBoundTotal
  - [x] Use quadratic formula from paper Section 13 to find partialIn
  - [x] Solve: djCrossover = √n * (alphaTotal - alphaXover) + diCrossover
  - [x] Substitute into torus invariant → quadratic in diCrossover
  - [x] Return (partialIn, partialOut)
- [x] Implement `_crossTick(tickIdx, state)`:
  - [x] If interior → boundary:
    - [x] state.rInt -= tick.r
    - [x] state.kBound += tick.k
    - [x] state.sBound += computeS(tick.r, tick.k, n)
    - [x] slot0 same updates
  - [x] If boundary → interior:
    - [x] state.rInt += tick.r
    - [x] state.kBound -= tick.k
    - [x] state.sBound -= computeS(tick.r, tick.k, n)
    - [x] slot0 same updates
  - [x] Flip tick.isInterior
  - [x] Assert invariant holds at crossover before continuing
  - [x] Emit TickCrossed

**3C-4 Burn (remove liquidity)**
- [x] Implement `burn(tickIndex, rWad)`:
  - [x] Look up position by positionKey(msg.sender, tickIndex)
  - [x] Require position.r >= rWad
  - [x] Call `_updatePositionFees(pos)` before modifying
  - [x] Compute withdraw amounts proportional to rWad / tick.r
  - [x] If tick is interior: slot0.rInt -= rWad
  - [x] If tick is boundary: slot0.kBound -= proportional k, slot0.sBound -= proportional s
  - [x] Update slot0.sumX, slot0.sumXSq
  - [x] Update reserves[]
  - [x] Update position.r -= rWad
  - [x] Delete position if r == 0
  - [x] Assert invariant holds after burn
  - [x] Emit Burn event

**3C-5 Collect (fees)**
- [x] Implement `collect(tickIndex)`:
  - [x] Look up position
  - [x] Call `_updatePositionFees(pos)`
  - [x] Read pos.tokensOwed
  - [x] Reset pos.tokensOwed = 0
  - [x] Distribute fees pro-rata across all n assets
  - [x] Transfer each fee amount to msg.sender
  - [x] Emit Collect event

**3C-6 Fee accounting**
- [x] Implement `_accumulateFee(feeAmount)`:
  - [x] If rInt == 0 skip (no interior liquidity to credit)
  - [x] feeGrowthGlobal += feeAmount * WAD / rInt
- [x] Implement `_updatePositionFees(Position storage pos)`:
  - [x] growth = feeGrowthGlobal - pos.feeGrowthInsideLast
  - [x] pos.tokensOwed += pos.r * growth / WAD
  - [x] pos.feeGrowthInsideLast = feeGrowthGlobal

**3C-7 Reserve accounting helpers**
- [x] Implement `_updateReserves(assetIn, assetOut, amountIn, amountOut)`:
  - [x] Update slot0.sumX: += amountIn, -= amountOut
  - [x] Update slot0.sumXSq using (x+d)² - x² = 2xd + d²
  - [x] Update reserves[assetIn] += amountIn
  - [x] Update reserves[assetOut] -= amountOut
- [x] Implement `_buildTorusState()` returns TorusMath.TorusState:
  - [x] Assemble from slot0 fields
- [x] Implement `_currentReserves()` returns uint256[]:
  - [x] Copy from reserves mapping into array
- [x] Implement `_computeDepositAmounts(kWad, rWad)`:
  - [x] If pool empty: return equalPricePoint amounts minus virtual
  - [x] If pool imbalanced: compute amounts to maintain current prices
- [x] Implement `_computeWithdrawAmounts(tickIndex, rWad)`:
  - [x] Return pro-rata share of pool reserves for this tick's rWad

**3C-8 Oracle**
- [x] Implement `observe(uint32[] secondsAgos)`:
  - [x] Call OrbitalOracle.observe with current state
  - [x] Return cumulative sumX and sumXSq arrays
- [x] Implement `increaseObservationCardinalityNext(uint16 next)`:
  - [x] Call OrbitalOracle.grow

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