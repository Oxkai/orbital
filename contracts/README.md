# Orbital AMM — Contracts

The Solidity implementation of the [Orbital](../readme.md) multi-asset
stablecoin AMM. Built with Foundry, structured after Uniswap V3
(factory + pool + callback router + ERC-721 position manager), but with the
sphere/torus invariant from the Paradigm Orbital paper replacing the
`x·y=k` curve so the pool can hold N ≥ 2 assets.

> **Status:** research prototype. The full Foundry suite (unit, fuzz, and
> invariant tests) passes on `forge test`. The system is not audited.

---

## What I built

| Layer       | Contract                    | What it does                                        |
| ----------- | --------------------------- | --------------------------------------------------- |
| Core        | `OrbitalFactory`            | Deploys pools, tracks fee tiers, global pause flag  |
| Core        | `OrbitalPoolDeployer`       | Holds constructor params during CREATE2 deployment  |
| Core        | `OrbitalPool`               | The AMM itself — mint, swap, burn, collect, oracle  |
| Periphery   | `OrbitalRouter`             | `exactInput` / `exactOutput` swaps with deadline    |
| Periphery   | `OrbitalQuoter`             | Off-chain price preview (V3 revert-style)           |
| Periphery   | `OrbitalPositionManager`    | Each LP position is an ERC-721                      |
| Periphery   | `OrbitalDescriptor`         | Token URI hook for the position NFT                 |
| Lib         | `SphereMath`                | √n, equal-price point, ‖w‖², spot price             |
| Lib         | `TorusMath`                 | Torus invariant check + Newton swap solver          |
| Lib         | `TickLib`                   | `kMin`, `kMax`, capital efficiency, tick geometry   |
| Lib         | `PositionLib`               | Position key + fee-growth accounting                |
| Lib         | `OrbitalOracle`             | TWAP ring buffer (65,535 slots, V3-style)           |
| Lib         | `FullMath` / `TransferHelper` | 512-bit mulDiv + safe ERC-20 transfers (from V3)  |

All pool math is WAD-native (1e18 fixed point). The factory rejects tokens
whose `decimals()` isn't 18 — mixing decimals would desynchronise callback
transfer amounts from pool state.

---

## Layout

```
contracts/
├── src/
│   ├── core/          Factory, Pool, PoolDeployer
│   ├── periphery/     Router, Quoter, PositionManager, Descriptor
│   ├── lib/           Sphere/Torus/Tick/Position/Oracle/FullMath/Transfer
│   ├── interfaces/    IOrbitalFactory, IOrbitalPool* (split V3-style),
│   │                  callback interfaces, IERC20Minimal, IERC20Metadata
│   └── mocks/         MockERC20, mint/swap callback helpers
├── script/            Deploy, DeploySepolia, Seed, SimulateDepeg
├── test/              Unit, fuzz, invariant tests
├── deployments/       Per-network address JSON (written by scripts)
└── foundry.toml
```

---

## Quick start

```bash
forge build
forge test
forge test -vv                    # verbose
forge test --match-contract OrbitalPoolTest --fuzz-runs 1000
```

### Local deploy + seed

```bash
# 1. Start a local node
anvil &

# 2. Deploy factory, mocks, pool, router, quoter, position manager
forge script script/Deploy.s.sol --broadcast \
    --rpc-url http://localhost:8545

# 3. Mint tokens, add 4 LPs at different k_norm, run 20 swaps
forge script script/Seed.s.sol --broadcast \
    --rpc-url http://localhost:8545

# 4. Optional: 50 escalating USDC→USDT swaps exercising depeg dynamics
forge script script/SimulateDepeg.s.sol --broadcast \
    --rpc-url http://localhost:8545
```

Addresses land in `deployments/local.json`.

### Sepolia deploy

```bash
export PRIVATE_KEY=0x...
export SEPOLIA_RPC_URL=https://...
export ETHERSCAN_API_KEY=...

forge script script/DeploySepolia.s.sol \
    --rpc-url $SEPOLIA_RPC_URL \
    --broadcast --verify
```

Written to `deployments/sepolia.json`.

---

## Using the protocol

### Swap (via router)

```solidity
router.exactInput(OrbitalRouter.SwapParams({
    pool:         poolAddr,
    assetIn:      0,                // index into pool.tokens()
    assetOut:     1,
    amountIn:     1_000e18,
    amountOutMin: 990e18,
    recipient:    msg.sender,
    deadline:     block.timestamp + 300
}));
```

`exactOutput` works symmetrically — `amountIn` is the max you'll spend.

### Quote before swapping

```solidity
uint256 out = quoter.quoteExactInput(pool, 0, 1, 1_000e18);
uint256 in_ = quoter.quoteExactOutput(pool, 0, 1, 500e18);
```

The quoter uses V3's revert-return trick — it is **not** marked `view` but
makes no state changes.

### Add liquidity (via position manager)

```solidity
uint256 k = TickLib.kMin(rWad, n) + depegBuffer; // any k ∈ [kMin, kMax]

positionManager.mint(OrbitalPositionManager.MintParams({
    pool:       poolAddr,
    kWad:       k,
    rWad:       100_000e18,
    amountsMin: new uint256[](n),
    recipient:  msg.sender,
    deadline:   block.timestamp + 300
}));
```

Each position is an ERC-721. `increaseLiquidity`, `decreaseLiquidity`,
`collect`, and `burn` follow the V3 position manager API.

### Multicall the router

```solidity
bytes[] memory calls = new bytes[](2);
calls[0] = abi.encodeCall(router.exactInput, /* ... swap 1 ... */);
calls[1] = abi.encodeCall(router.exactInput, /* ... swap 2 ... */);
router.multicall(calls);
```

---

## Architecture cheatsheet

| Uniswap V3                    | Orbital                           | Notes                                |
| ----------------------------- | --------------------------------- | ------------------------------------ |
| `UniswapV3Factory`            | `OrbitalFactory`                  | Same create+registry pattern         |
| `UniswapV3Pool`               | `OrbitalPool`                     | Sphere/torus instead of `x·y=k`      |
| `SwapRouter`                  | `OrbitalRouter`                   | Assets are indices not addresses     |
| `NonfungiblePositionManager`  | `OrbitalPositionManager`          | Identical ERC-721 flow               |
| `Quoter`                      | `OrbitalQuoter`                   | Same revert-extraction pattern       |
| `TickMath`                    | `SphereMath`                      | Sphere geometry, no log ticks        |
| `SqrtPriceMath`               | `TorusMath`                       | Newton solver for torus invariant    |
| `Oracle`                      | `OrbitalOracle`                   | TWAP on `sumX`, `sumXSq`             |
| `sqrtPriceX96` (Q64.96)       | `sumX`, `sumXSq` (WAD)            | Different hot-state encoding         |
| `liquidity` (uint128)         | `rInt` (WAD)                      | Consolidated interior radius         |
| `tick` (int24 log bucket)     | `tick` (k plane constant, WAD)    | Nested ticks, not disjoint           |
| 2 tokens                      | N tokens (n ≥ 2)                  | The main differentiator              |

Invariants enforced on every mint/swap/burn:

1. Torus LHS ≈ `rInt²` with relative drift < 1 ppm
2. `sumX == Σ reserves[i]`
3. `sumXSq == Σ reserves[i]² / WAD`
4. `rInt == Σ r over interior ticks`
5. `kBound`, `sBound == Σ k, s over boundary ticks`

---

## Admin surface

- `factory.setPaused(bool)` — emergency halt on mint/swap/burn across all
  pools. `collect` stays open so LPs can always withdraw credited fees.
- `factory.enableFeeAmount(uint24)` — add a new fee tier (cannot disable
  existing ones).
- `factory.setOwner` / `acceptOwner` — two-step ownership transfer.
- No protocol fee, no upgradeability, no per-pool admin.

---

## Testing

Tests are organised by component:

| Suite                     | Covers                                        |
| ------------------------- | --------------------------------------------- |
| `SphereMathTest`          | √n, equal-price point, ‖w‖², spot price       |
| `TorusMathTest`           | Invariant check, Newton solver convergence    |
| `TickLibTest`             | `kMin`/`kMax` bounds, capital efficiency      |
| `OrbitalOracleTest`       | TWAP ring buffer growth + observe window      |
| `OrbitalFactoryTest`      | Create pool, fee tiers, pause, owner transfer |
| `OrbitalPoolMintTest`     | Mint geometry, tick boundary handling         |
| `OrbitalPoolTest`         | Swaps, crossings, fee accrual, fuzz/invariant |
| `OrbitalRouterTest`       | Exact-in/out, slippage, deadline, pause, multicall |

Run invariant suites explicitly with `forge test --match-test invariant_`.

---

## Further reading

- Paradigm Orbital paper — https://www.paradigm.xyz/2025/06/orbital
- Uniswap V3 whitepaper — architectural reference
- [../simulation/](../simulation/) — Python reference implementation
