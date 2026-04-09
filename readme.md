# Orbital AMM — Full Implementation TODO

> Implementing the Paradigm paper: Spherical AMM with concentrated liquidity for N stablecoins.
> Reference: https://www.paradigm.xyz/2025/06/orbital

---

## Phase 0 — Project Setup

- [ ] Create monorepo root folder `orbital-amm/`
- [ ] Inside it create three folders: `contracts/`, `simulation/`, `frontend/`
- [ ] Initialize git repo at root
- [ ] Create root `.gitignore` covering node_modules, .env, out/, cache/, __pycache__/
- [ ] Create root `README.md` with project description

---

## Phase 1 — Math Simulation (Python)

> Goal: Understand and verify every formula from the paper before writing any Solidity.
> Folder: `simulation/`

### 1.1 Environment
- [ ] Create `simulation/requirements.txt` with: numpy, matplotlib, scipy, jupyter, pytest
- [ ] Create `simulation/` Python virtual environment
- [ ] Install dependencies

### 1.2 Core Sphere AMM
- [ ] Create `simulation/sphere_amm.py`
- [ ] Implement `SphereAMM` class with:
  - [ ] Constructor: takes `n` (number of assets) and `r` (radius)
  - [ ] `reserves` array initialized at equal-price point
  - [ ] `check_invariant()` — verifies ||r_vec − x_vec||² == r²
  - [ ] `equal_price_point()` — returns q = r(1 − 1/√n) for each asset
  - [ ] `get_price(i, j)` — returns (r − x_j) / (r − x_i)
  - [ ] `swap(asset_in, asset_out, amount_in)` — Newton's method to solve for amount_out

### 1.3 Polar Decomposition
- [ ] Add to `sphere_amm.py`:
  - [ ] `v_vector()` — returns unit vector (1/√n, 1/√n, ..., 1/√n)
  - [ ] `polar_decompose(x)` — returns (alpha, w) where x = alpha*v + w
  - [ ] `alpha_from_reserves()` — computes x·v (parallel component)
  - [ ] `w_norm_from_reserves()` — computes ||x − (x·v)v|| (orthogonal magnitude)

### 1.4 Tick System
- [ ] Create `simulation/tick.py`
- [ ] Implement `Tick` class with:
  - [ ] Constructor: takes `k` (plane constant), `r` (radius)
  - [ ] `k_min()` — minimum valid k = r(√n − 1)
  - [ ] `k_max()` — maximum valid k = r(n−1)/√n
  - [ ] `x_min(k)` — minimum reserve of any one asset on this tick
  - [ ] `x_max(k)` — maximum reserve of any one asset on this tick
  - [ ] `boundary_radius_s()` — radius of (n−1)-sphere when on boundary: √(r² − (k − r√n)²)
  - [ ] `is_interior(alpha_norm)` — returns True if k_norm > alpha_int_norm
  - [ ] `k_norm()` — normalized boundary = k / r

### 1.5 Capital Efficiency
- [ ] Add to `tick.py`:
  - [ ] `x_base()` — base reserve at equal-price point = r(1 − 1/√n)
  - [ ] `capital_efficiency(k)` — ratio x_base / (x_base − x_min(k))
  - [ ] `k_from_depeg_price(p_depeg)` — given a target depeg price, compute matching k
  - [ ] `capital_efficiency_from_depeg(p_depeg)` — combines above two

### 1.6 Tick Consolidation
- [ ] Create `simulation/consolidation.py`
- [ ] Implement:
  - [ ] `consolidate_interior_ticks(ticks)` — returns single effective r_int = Σ r_i
  - [ ] `consolidate_boundary_ticks(ticks)` — returns single effective s_bound = Σ s_i
  - [ ] `k_bound_total(boundary_ticks)` — sum of k values of all boundary ticks

### 1.7 Global Torus Invariant
- [ ] Add to `consolidation.py`:
  - [ ] `torus_invariant(x_total, r_int, k_bound, r_bound, n)` — computes full invariant value
  - [ ] `check_torus_invariant(...)` — asserts invariant holds within tolerance
  - [ ] `compute_sum_x(reserves)` — Σ xᵢ
  - [ ] `compute_sum_x_sq(reserves)` — Σ xᵢ²

### 1.8 Full Multi-Tick Swap
- [ ] Create `simulation/orbital_amm.py`
- [ ] Implement `OrbitalAMM` class with:
  - [ ] Constructor: takes list of ticks, n assets
  - [ ] `swap(asset_in, asset_out, amount_in)`:
    - [ ] Step 1: compute potential final state assuming no tick crossing
    - [ ] Step 2: boundary crossing check (compare alpha_int_norm vs k_int_min and k_bound_max)
    - [ ] Step 3: if crossing detected, find crossover point using quadratic formula
    - [ ] Step 4: execute trade to crossover, flip tick interior/boundary status, recurse for remainder
  - [ ] `add_tick(k, r)` — add a new liquidity tick
  - [ ] `remove_tick(k)` — remove a tick
  - [ ] `get_spot_price(i, j)` — current price
  - [ ] `get_state()` — returns sum_x, sum_x_sq, r_int, k_bound_total, s_bound

### 1.9 Tests
- [ ] Create `simulation/tests/`
- [ ] `test_sphere_invariant.py` — after every swap, invariant holds
- [ ] `test_equal_price.py` — at equal-price point, all pairwise prices == 1
- [ ] `test_price_direction.py` — adding asset i increases price of i relative to j
- [ ] `test_tick_bounds.py` — k_min < any valid k < k_max
- [ ] `test_capital_efficiency.py` — efficiency increases as depeg threshold approaches 1
- [ ] `test_tick_crossing.py` — trade that crosses a boundary produces correct output
- [ ] `test_swap_symmetry.py` — swap(i→j, amount) then swap(j→i, amount_out) returns close to original
- [ ] `test_multi_tick.py` — 5-tick pool produces valid trades end-to-end
- [ ] `test_torus_invariant.py` — torus invariant holds at every step of a segmented trade

### 1.10 Notebooks
- [ ] Create `simulation/notebooks/01_sphere_basics.ipynb` — visualize 2D and 3D sphere AMM
- [ ] Create `simulation/notebooks/02_ticks_and_efficiency.ipynb` — plot capital efficiency vs depeg price
- [ ] Create `simulation/notebooks/03_full_swap_simulation.ipynb` — simulate 1000 swaps, show reserve path
- [ ] Create `simulation/notebooks/04_depeg_scenario.ipynb` — simulate one asset depegging to 0, show reserves moving to boundary

---

## Phase 2 — Solidity Contracts

> Goal: Implement the full paper on-chain.
> Folder: `contracts/`

### 2.1 Foundry Setup
- [ ] Run `forge init` inside `contracts/`
- [ ] Add dependencies: `forge install transmissions11/solmate` (ERC-20, SafeTransferLib)
- [ ] Add dependencies: `forge install PaulRBerg/prb-math` (fixed-point 18-decimal math)
- [ ] Add dependencies: `forge install OpenZeppelin/openzeppelin-contracts` (ReentrancyGuard, Ownable)
- [ ] Configure `foundry.toml`: solc 0.8.24, optimizer 200 runs, via-ir true
- [ ] Create `contracts/src/` and `contracts/test/` folders

### 2.2 Math Library
- [ ] Create `contracts/src/lib/OrbitalMath.sol`
- [ ] Implement (all in fixed-point 18-decimal using PRBMath):
  - [ ] `sqrt(uint256)` — integer square root
  - [ ] `computeAlpha(uint256[] reserves, uint256 n)` — returns Σxᵢ / √n
  - [ ] `computeWNormSq(uint256 sumX, uint256 sumXSq, uint256 n)` — Σxᵢ² − (Σxᵢ)²/n
  - [ ] `computeSBound(uint256 r, uint256 k, uint256 n)` — boundary radius s = √(r² − (k − r√n)²)
  - [ ] `torusInvariantLHS(uint256 sumX, uint256 sumXSq, uint256 kBound, uint256 rBound, uint256 rInt, uint256 n)` — compute full torus invariant left side
  - [ ] `newtonSwap(...)` — Newton's method solver for swap output (10 iterations)
  - [ ] `solveQuadraticCrossover(...)` — quadratic formula for tick crossing point

### 2.3 Tick Library
- [ ] Create `contracts/src/lib/TickLib.sol`
- [ ] Implement:
  - [ ] `Tick` struct: `{ uint256 k, uint256 r, bool isInterior, uint256 sumX, uint256 sumXSq }`
  - [ ] `kMin(uint256 r, uint256 n)` — minimum valid k
  - [ ] `kMax(uint256 r, uint256 n)` — maximum valid k
  - [ ] `xMin(uint256 k, uint256 r, uint256 n)` — minimum reserve per asset
  - [ ] `xMax(uint256 k, uint256 r, uint256 n)` — maximum reserve per asset
  - [ ] `boundaryRadius(uint256 r, uint256 k, uint256 n)` — s value
  - [ ] `kNorm(uint256 k, uint256 r)` — normalized k = k/r
  - [ ] `isInteriorTick(uint256 alphaNorm, uint256 kNorm)` — comparison

### 2.4 Core Pool Contract
- [ ] Create `contracts/src/OrbitalPool.sol`
- [ ] Implement storage:
  - [ ] `address[] public tokens` — list of stablecoin addresses
  - [ ] `uint256 public n` — number of assets
  - [ ] `Tick[] public ticks` — all registered ticks, sorted by k
  - [ ] `uint256 public sumX` — global Σxᵢ
  - [ ] `uint256 public sumXSq` — global Σxᵢ²
  - [ ] `uint256 public rInt` — consolidated interior radius
  - [ ] `uint256 public sBound` — consolidated boundary radius
  - [ ] `uint256 public kBoundTotal` — sum of k values of boundary ticks
  - [ ] `mapping(uint256 => uint256) public reserves` — per-asset reserves
- [ ] Implement functions:
  - [ ] `constructor(address[] tokens, uint256[] initialReserves)`
  - [ ] `swap(uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256 minAmountOut) returns (uint256 amountOut)`
  - [ ] `_swapWithinTick(...)` — single-segment swap using torus invariant
  - [ ] `_detectTickCrossing()` — returns which tick (if any) is crossed
  - [ ] `_executeCrossover(...)` — trade to exact boundary, flip tick status, update consolidated params
  - [ ] `_updateConsolidatedParams()` — recompute rInt, sBound, kBoundTotal after tick status change
  - [ ] `_verifyInvariant()` — sanity check (can be removed in production for gas)
  - [ ] Events: `Swap(address indexed sender, uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256 amountOut)`

### 2.5 Liquidity Management
- [ ] Create `contracts/src/OrbitalLP.sol` (or add to OrbitalPool.sol)
- [ ] Implement LP position as ERC-721 (each position = one tick with one LP):
  - [ ] `addLiquidity(uint256 k, uint256 r, uint256[] amounts) returns (uint256 tokenId)`
  - [ ] `removeLiquidity(uint256 tokenId) returns (uint256[] amounts)`
  - [ ] `collectFees(uint256 tokenId) returns (uint256[] fees)`
- [ ] Implement fee accounting:
  - [ ] `uint256 public feeBps` — fee in basis points (e.g. 5 = 0.05%)
  - [ ] Per-tick fee accumulator: `feeGrowthGlobal` similar to Uni v3 pattern
  - [ ] `_accumulateFees(uint256 amountIn)` — called on every swap
- [ ] Implement virtual reserve accounting:
  - [ ] On addLiquidity: compute x_min, only require deposit of (x_base − x_min) per asset
  - [ ] On removeLiquidity: return actual reserves minus virtual portion

### 2.6 Router
- [ ] Create `contracts/src/OrbitalRouter.sol`
- [ ] Implement:
  - [ ] `swapExactIn(address pool, uint256 assetIn, uint256 assetOut, uint256 amountIn, uint256 minOut)`
  - [ ] `swapExactOut(address pool, uint256 assetIn, uint256 assetOut, uint256 amountOut, uint256 maxIn)`
  - [ ] `quoteSwap(address pool, uint256 assetIn, uint256 assetOut, uint256 amountIn) returns (uint256)`
  - [ ] Slippage protection on all swap functions
  - [ ] Deadline parameter on all swap functions

### 2.7 Factory
- [ ] Create `contracts/src/OrbitalFactory.sol`
- [ ] Implement:
  - [ ] `createPool(address[] tokens, uint256[] initialAmounts) returns (address pool)`
  - [ ] `mapping(bytes32 => address) public getPool` — lookup pool by token set hash
  - [ ] `allPools()` — return all deployed pools

### 2.8 Mock Tokens (for testing)
- [ ] Create `contracts/src/mocks/MockERC20.sol`
- [ ] Deploy 5 mock stablecoins: MockUSDC, MockUSDT, MockDAI, MockFRAX, MockLUSD
- [ ] Add `mint(address to, uint256 amount)` function (no auth, for testnet)

### 2.9 Contract Tests
- [ ] Create `contracts/test/OrbitalMath.t.sol`
  - [ ] Test all math functions against Python simulation outputs
  - [ ] Fuzz test: `invariant_sphereAlwaysHolds()` — after any swap, torus invariant holds
- [ ] Create `contracts/test/OrbitalPool.t.sol`
  - [ ] `test_swapBasic()` — simple 2-asset swap
  - [ ] `test_swapSymmetry()` — swap back and forth returns close to original
  - [ ] `test_tickCrossing()` — trade large enough to cross one tick boundary
  - [ ] `test_multiplTickCrossings()` — trade crosses 3 tick boundaries
  - [ ] `test_depegScenario()` — one asset floods into pool, reserves hit boundary
  - [ ] `test_capitalEfficiency()` — LP deposits less than full unbounded amount
  - [ ] `test_feesAccumulate()` — after 100 swaps, fees are collectible
  - [ ] `test_fuzz_swap(uint256 amountIn)` — fuzz on amount, invariant always holds
  - [ ] `test_fuzz_addRemoveLiquidity(uint256 k)` — fuzz on tick position
- [ ] Create `contracts/test/OrbitalRouter.t.sol`
  - [ ] `test_routerSwapExactIn()`
  - [ ] `test_routerSlippageProtection()`
  - [ ] `test_routerDeadlineExpired()`

### 2.10 Gas Benchmarks
- [ ] Create `contracts/test/Gas.t.sol`
- [ ] Benchmark and record gas for:
  - [ ] Swap with 0 tick crossings (3-asset pool)
  - [ ] Swap with 0 tick crossings (10-asset pool)
  - [ ] Swap with 1 tick crossing (3-asset pool)
  - [ ] Swap with 3 tick crossings (3-asset pool)
  - [ ] addLiquidity
  - [ ] removeLiquidity
- [ ] Target: swap with 0 crossings under 200k gas

### 2.11 Security
- [ ] Run `slither contracts/src/` and fix all High/Medium findings
- [ ] Add `ReentrancyGuard` to all state-changing functions
- [ ] Add `SafeTransferLib` for all token transfers
- [ ] Check: no unbounded loops
- [ ] Check: overflow/underflow on all arithmetic
- [ ] Check: price manipulation via flash loans (add TWAP oracle)
- [ ] Add `pause()` / `unpause()` admin function for emergencies

### 2.12 Deployment Scripts
- [ ] Create `contracts/script/Deploy.s.sol`
- [ ] Script deploys: Factory → MockTokens → Pool (USDC/USDT/DAI/FRAX/LUSD) → Router
- [ ] Script sets initial liquidity: 5 ticks at k values corresponding to depeg floors 0.999, 0.99, 0.97, 0.93, 0.85
- [ ] Create `contracts/script/DeployTestnet.s.sol` — same but with Sepolia config
- [ ] Create `.env.example` with required env vars: PRIVATE_KEY, RPC_URL, ETHERSCAN_KEY

---

## Phase 3 — Subgraph (Indexer)

> Goal: Index all swaps, liquidity events, tick crossings for the frontend.
> Folder: `subgraph/`

- [ ] Install Graph CLI: `npm install -g @graphprotocol/graph-cli`
- [ ] Run `graph init` targeting OrbitalPool contract on Sepolia
- [ ] Define schema in `subgraph/schema.graphql`:
  - [ ] `Pool` entity: id, tokens, numAssets, totalSwapVolume, totalLiquidity
  - [ ] `Swap` entity: id, pool, assetIn, assetOut, amountIn, amountOut, timestamp, sender
  - [ ] `Tick` entity: id, pool, k, r, isInterior, currentReserves
  - [ ] `LiquidityPosition` entity: id, owner, pool, k, r, depositedAmounts, feesEarned
  - [ ] `TickCrossing` entity: id, swap, tickK, direction (interior→boundary or reverse)
  - [ ] `ReserveSnapshot` entity: id, pool, timestamp, sumX, sumXSq, reserves[]
- [ ] Write mapping handlers in `subgraph/src/mappings.ts`:
  - [ ] `handleSwap` — update Pool, create Swap, create ReserveSnapshot
  - [ ] `handleTickCrossing` — update Tick status
  - [ ] `handleLiquidityAdded` — create LiquidityPosition
  - [ ] `handleLiquidityRemoved` — update LiquidityPosition
- [ ] Deploy subgraph to The Graph hosted service (Sepolia)
- [ ] Test all queries return expected data

---

## Phase 4 — Frontend

> Goal: Full working UI to interact with the deployed contracts.
> Folder: `frontend/`

### 4.1 Setup
- [ ] `npx create-next-app@latest frontend --typescript --tailwind --app`
- [ ] Install: `wagmi`, `viem`, `@tanstack/react-query`
- [ ] Install: `recharts` (charts), `d3` (sphere visualization)
- [ ] Install: `@radix-ui/react-slider`, `@radix-ui/react-dialog`, `@radix-ui/react-tabs`
- [ ] Install: `three` + `@types/three` (3D sphere demo)
- [ ] Create `frontend/src/constants/contracts.ts` — ABI + addresses per network
- [ ] Create `frontend/src/lib/wagmi.ts` — configure wagmi with Sepolia + local Anvil

### 4.2 Pages & Layout
- [ ] Create root layout with: navbar (logo, connect wallet button, network indicator)
- [ ] Create `/` — home page with stats: total pools, total volume, total TVL
- [ ] Create `/swap` — swap page
- [ ] Create `/liquidity` — LP management page
- [ ] Create `/pool/[address]` — individual pool detail page
- [ ] Create `/demo` — visual demo / educational page

### 4.3 Swap Page
- [ ] Build `AssetSelector` component — dropdown showing token symbols + balances
- [ ] Build `SwapForm` component:
  - [ ] Asset In selector + amount input
  - [ ] Asset Out selector + computed amount output (calls `quoteSwap`)
  - [ ] Price impact display (warn if > 1%)
  - [ ] Slippage tolerance setting (0.1% / 0.5% / 1% / custom)
  - [ ] Deadline setting
  - [ ] Swap button → calls router, shows pending → success/fail state
- [ ] Build `SwapRoute` component — shows which ticks were crossed in the trade
- [ ] Build `PriceChart` component — 24h price of asset i vs j (from subgraph)

### 4.4 Liquidity Page
- [ ] Build `AddLiquidityForm` component:
  - [ ] Tick k selector: slider from k_min to k_max
  - [ ] Show corresponding depeg protection floor (e.g. "your tick covers down to $0.97")
  - [ ] Show capital efficiency multiplier live as k changes
  - [ ] Show required deposit amounts (actual, not virtual)
  - [ ] Confirm → calls addLiquidity
- [ ] Build `PositionsList` component — shows all user LP positions with:
  - [ ] Current reserves
  - [ ] Uncollected fees
  - [ ] Status: interior or boundary (pinned)
  - [ ] Remove liquidity button
  - [ ] Collect fees button
- [ ] Build `CapitalEfficiencyChart` component:
  - [ ] X-axis: depeg protection floor (0.80 → 0.999)
  - [ ] Y-axis: capital efficiency multiplier
  - [ ] User's selected k shown as vertical line

### 4.5 Pool Detail Page
- [ ] Build `ReserveState` component — current reserves of all N assets as bar chart
- [ ] Build `TickMap` component — all ticks shown as horizontal bands, colored by interior/boundary status
- [ ] Build `ReserveHistory` component — line chart of reserve path over time (from subgraph snapshots)
- [ ] Build `PoolStats` component — 24h volume, TVL, fee revenue, number of active ticks

### 4.6 3D Sphere Visualization (Demo Page)
- [ ] Create `frontend/src/components/SphereViz.tsx` using Three.js:
  - [ ] Render 1/8 of sphere surface (positive octant only — reserves are always positive)
  - [ ] Draw the equal-price point q as a glowing dot
  - [ ] Draw tick boundaries as circles (latitude lines) on the sphere surface
  - [ ] Draw current reserve state as a moving point on the sphere
  - [ ] Color the tick band the reserve point is in (interior = teal, boundary = amber)
  - [ ] Animate the point moving as swaps happen
  - [ ] Add orbit controls (mouse drag to rotate)
- [ ] Create demo controls panel:
  - [ ] "Simulate swap" button — moves the reserve point along the sphere
  - [ ] "Simulate depeg" slider — gradually moves one asset's reserve toward 0, watch point approach boundary
  - [ ] "Add tick" button — draws a new boundary circle on the sphere
  - [ ] Speed control for animations
- [ ] Create side panel showing live numbers: current reserves, current prices, which ticks are interior vs boundary

### 4.7 Shared Components
- [ ] `WalletButton` — connect/disconnect, shows address + balance
- [ ] `TransactionModal` — pending / success / fail states
- [ ] `TokenIcon` — token logo by address
- [ ] `NumberInput` — handles decimal formatting, max button
- [ ] `Tooltip` — hover explanations for DeFi terms

### 4.8 Contract Hooks
- [ ] `useSwap(poolAddress)` — wraps swap call with loading/error state
- [ ] `useQuoteSwap(poolAddress, assetIn, assetOut, amountIn)` — debounced quote
- [ ] `useAddLiquidity(poolAddress)` — wraps addLiquidity
- [ ] `useRemoveLiquidity(poolAddress)` — wraps removeLiquidity
- [ ] `usePoolState(poolAddress)` — reads sumX, sumXSq, ticks, reserves
- [ ] `useUserPositions(poolAddress, userAddress)` — reads LP NFTs
- [ ] `usePoolStats(poolAddress)` — fetches from subgraph

### 4.9 Frontend Tests
- [ ] Set up Vitest + React Testing Library
- [ ] `SwapForm.test.tsx` — renders, input updates quote, submit calls hook
- [ ] `AddLiquidityForm.test.tsx` — k slider updates efficiency display
- [ ] `CapitalEfficiencyChart.test.tsx` — chart renders with correct data shape
- [ ] E2E with Playwright:
  - [ ] `swap.spec.ts` — connect wallet (mock), enter swap, confirm, verify balance change
  - [ ] `liquidity.spec.ts` — add position, verify appears in list, remove it

---

## Phase 5 — Integration & Testnet Deployment

### 5.1 Local End-to-End
- [ ] Start local Anvil node: `anvil --chain-id 31337`
- [ ] Deploy all contracts to Anvil using deploy script
- [ ] Mint mock tokens to test wallet
- [ ] Point frontend to local Anvil (chain 31337)
- [ ] Run through full user flow manually:
  - [ ] Add liquidity on 3 ticks
  - [ ] Execute small swap (within one tick)
  - [ ] Execute large swap (crosses tick boundary)
  - [ ] Simulate depeg (flood one asset, watch reserves pin to boundary)
  - [ ] Collect fees
  - [ ] Remove liquidity

### 5.2 Sepolia Testnet Deployment
- [ ] Get Sepolia ETH from faucet
- [ ] Deploy all contracts to Sepolia: `forge script Deploy.s.sol --broadcast --verify`
- [ ] Verify all contracts on Etherscan (--verify flag)
- [ ] Note all deployed addresses in `contracts/deployments/sepolia.json`
- [ ] Deploy and sync subgraph to The Graph (Sepolia)
- [ ] Update `frontend/src/constants/contracts.ts` with Sepolia addresses
- [ ] Deploy frontend to Vercel

### 5.3 Seed Data
- [ ] Write `script/Seed.s.sol` that:
  - [ ] Mints 5M of each mock stablecoin to deployer
  - [ ] Adds 5 liquidity ticks with varying k values
  - [ ] Deposits initial liquidity into each tick
  - [ ] Executes 20 sample swaps to generate volume history
- [ ] Run seed script on Sepolia

---

## Phase 6 — Showcase & Documentation

### 6.1 Smart Contract Documentation
- [ ] Add NatSpec comments to every public function in all contracts
- [ ] Create `contracts/docs/` with:
  - [ ] `architecture.md` — how contracts relate to each other
  - [ ] `math.md` — derivation of key formulas used in code
  - [ ] `invariants.md` — list of all invariants the system must maintain

### 6.2 Frontend Documentation
- [ ] Write `frontend/README.md` with setup + run instructions
- [ ] Add tooltip explanations in UI for every DeFi concept:
  - [ ] "What is a tick?" tooltip on LP page
  - [ ] "What is capital efficiency?" tooltip on LP form
  - [ ] "What is a depeg?" tooltip on pool page

### 6.3 Demo Script
- [ ] Write a 5-minute demo walkthrough script covering:
  - [ ] Explain why Orbital is needed (stablecoin explosion)
  - [ ] Show sphere visualization, explain equal-price point
  - [ ] Add 3 liquidity ticks at different k values, show efficiency numbers
  - [ ] Execute a normal swap (small, no tick crossing)
  - [ ] Execute a large swap (crosses tick boundary, show segmentation in UI)
  - [ ] Simulate depeg: move one asset price to $0.90, show reserves pin at boundary
  - [ ] Show that other assets continue trading normally (depeg isolation)
  - [ ] Compare TVL required vs Curve for same liquidity depth

### 6.4 README (Root)
- [ ] Write `orbital-amm/README.md` with:
  - [ ] One-line description
  - [ ] Link to Paradigm paper
  - [ ] Architecture diagram (ASCII or image)
  - [ ] Monorepo structure overview
  - [ ] Quick start instructions (local setup, test, deploy)
  - [ ] Link to live Sepolia deployment
  - [ ] Link to live frontend
  - [ ] Known limitations / what's not implemented
  - [ ] What you'd add next if continuing

### 6.5 Blog Post / Write-up (Optional but impactful)
- [ ] Write `docs/writeup.md` covering:
  - [ ] Your summary of the paper's key ideas
  - [ ] What was hard to implement and why
  - [ ] Key differences between your prototype and a production version
  - [ ] Gas numbers you achieved
  - [ ] Capital efficiency numbers for your test pool

---

## Folder Structure (Final)

```
orbital-amm/
├── contracts/
│   ├── src/
│   │   ├── lib/
│   │   │   ├── OrbitalMath.sol
│   │   │   └── TickLib.sol
│   │   ├── mocks/
│   │   │   └── MockERC20.sol
│   │   ├── OrbitalPool.sol
│   │   ├── OrbitalLP.sol
│   │   ├── OrbitalRouter.sol
│   │   └── OrbitalFactory.sol
│   ├── test/
│   │   ├── OrbitalMath.t.sol
│   │   ├── OrbitalPool.t.sol
│   │   ├── OrbitalRouter.t.sol
│   │   └── Gas.t.sol
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   ├── DeployTestnet.s.sol
│   │   └── Seed.s.sol
│   ├── deployments/
│   │   └── sepolia.json
│   └── foundry.toml
│
├── simulation/
│   ├── sphere_amm.py
│   ├── tick.py
│   ├── consolidation.py
│   ├── orbital_amm.py
│   ├── tests/
│   │   ├── test_sphere_invariant.py
│   │   ├── test_tick_bounds.py
│   │   ├── test_tick_crossing.py
│   │   ├── test_torus_invariant.py
│   │   └── test_multi_tick.py
│   ├── notebooks/
│   │   ├── 01_sphere_basics.ipynb
│   │   ├── 02_ticks_and_efficiency.ipynb
│   │   ├── 03_full_swap_simulation.ipynb
│   │   └── 04_depeg_scenario.ipynb
│   └── requirements.txt
│
├── subgraph/
│   ├── schema.graphql
│   ├── subgraph.yaml
│   └── src/
│       └── mappings.ts
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          (home)
│   │   │   ├── swap/page.tsx
│   │   │   ├── liquidity/page.tsx
│   │   │   ├── pool/[address]/page.tsx
│   │   │   └── demo/page.tsx
│   │   ├── components/
│   │   │   ├── swap/
│   │   │   ├── liquidity/
│   │   │   ├── pool/
│   │   │   ├── viz/
│   │   │   │   └── SphereViz.tsx
│   │   │   └── shared/
│   │   ├── hooks/
│   │   ├── constants/
│   │   └── lib/
│   └── package.json
│
├── docs/
│   └── writeup.md
│
├── .gitignore
└── README.md
```

---

## Quick Start (after everything is built)

```bash
# 1. Run math simulation tests
cd simulation && python -m pytest tests/ -v

# 2. Run contract tests
cd contracts && forge test -vv

# 3. Start local chain + deploy
anvil &
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545

# 4. Seed local chain
forge script script/Seed.s.sol --broadcast --rpc-url http://localhost:8545

# 5. Start frontend
cd frontend && npm run dev
```