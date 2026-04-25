# Orbital — Contracts

The Solidity implementation of the [Orbital](../README.md) multi-asset stablecoin AMM. Built with Foundry, structured after Uniswap V3 (factory + pool + router + ERC-721 position manager), with the sphere/torus invariant replacing `x·y=k` to support N ≥ 2 assets in a single pool.

Hot state is compressed to five WAD-scaled aggregates (`sumX`, `sumXSq`, `rInt`, `kBound`, `sBound`) in `slot0`, so every mint, swap, and burn verifies the torus invariant in O(1) — no iteration over ticks or assets. Each LP position sets a k-plane defining its depeg tolerance independently, and all math is cross-validated against the Python reference implementation in [`simulation/`](../simulation/).

> Research prototype — full test suite passes on `forge test`. Not audited.

---

## Contract reference

| Layer     | Contract                      | Description                                        |
| --------- | ----------------------------- | -------------------------------------------------- |
| Core      | `OrbitalFactory`              | Deploys pools, tracks fee tiers, global pause flag |
| Core      | `OrbitalPoolDeployer`         | Holds constructor params during CREATE2 deployment |
| Core      | `OrbitalPool`                 | The AMM — mint, swap, burn, collect, oracle        |
| Periphery | `OrbitalRouter`               | `exactInput` / `exactOutput` swaps with deadline   |
| Periphery | `OrbitalQuoter`               | Off-chain price preview (V3 revert-style)          |
| Periphery | `OrbitalPositionManager`      | Each LP position is an ERC-721                     |
| Periphery | `OrbitalDescriptor`           | Token URI hook for position NFTs                   |
| Lib       | `SphereMath`                  | √n, equal-price point, ‖w‖², spot price            |
| Lib       | `TorusMath`                   | Torus invariant check + Newton swap solver         |
| Lib       | `TickLib`                     | `kMin`, `kMax`, capital efficiency, tick geometry  |
| Lib       | `PositionLib`                 | Position key + fee-growth accounting               |
| Lib       | `OrbitalOracle`               | TWAP ring buffer (65,535 slots, V3-style)          |
| Lib       | `FullMath` / `TransferHelper` | 512-bit mulDiv + safe ERC-20 transfers             |

All pool math is WAD-native (1e18). The factory rejects tokens with `decimals() != 18`.

---

## Layout

```
contracts/
├── src/
│   ├── core/          Factory, Pool, PoolDeployer
│   ├── periphery/     Router, Quoter, PositionManager, Descriptor
│   ├── lib/           SphereMath, TorusMath, TickLib, PositionLib,
│   │                  OrbitalOracle, FullMath, TransferHelper
│   ├── interfaces/    IOrbitalFactory, IOrbitalPool, callback interfaces
│   └── mocks/         MockERC20, mint/swap callback helpers
├── script/            Deploy, DeploySepolia, Seed, SimulateDepeg
├── test/              Unit, fuzz, invariant tests (134 tests, 8 suites)
├── deployments/       Per-network address JSON (written by deploy scripts)
└── foundry.toml
```

---

## Quick start

```bash
forge build
forge test
forge test -vv
forge test --match-contract OrbitalPoolTest --fuzz-runs 1000
```

### Local deploy

```bash
anvil &

forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545
forge script script/Seed.s.sol --broadcast --rpc-url http://localhost:8545

# Optional: 50 escalating swaps exercising depeg dynamics
forge script script/SimulateDepeg.s.sol --broadcast --rpc-url http://localhost:8545
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

Addresses written to `deployments/sepolia.json`.

---

## Using the protocol

### Swap

```solidity
router.exactInput(OrbitalRouter.SwapParams({
    pool:         poolAddr,
    assetIn:      0,          // index into pool.tokens()
    assetOut:     1,
    amountIn:     1_000e18,
    amountOutMin: 990e18,
    recipient:    msg.sender,
    deadline:     block.timestamp + 300
}));
```

`exactOutput` works symmetrically — `amountIn` becomes the spend cap.

### Quote

```solidity
uint256 out = quoter.quoteExactInput(pool, 0, 1, 1_000e18);
uint256 in_ = quoter.quoteExactOutput(pool, 0, 1, 500e18, 510e18);
```

The quoter uses V3's revert-return pattern — not `view`, but makes no state changes.

### Add liquidity

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

Each position is an ERC-721. `increaseLiquidity`, `decreaseLiquidity`, `collect`, and `burn` follow the standard V3 position manager API.

---

## Testing

134 tests across 8 suites — all pass on `forge test`.

| Suite                 | Covers                                             |
| --------------------- | -------------------------------------------------- |
| `SphereMathTest`      | √n, equal-price point, ‖w‖², spot price            |
| `TorusMathTest`       | Invariant check, Newton solver convergence         |
| `TickLibTest`         | `kMin`/`kMax` bounds, capital efficiency           |
| `OrbitalOracleTest`   | TWAP ring buffer growth + observe window           |
| `OrbitalFactoryTest`  | Create pool, fee tiers, pause, owner transfer      |
| `OrbitalPoolMintTest` | Mint geometry, tick boundary handling              |
| `OrbitalPoolTest`     | Swaps, crossings, fee accrual, fuzz, invariants    |
| `OrbitalRouterTest`   | Exact-in/out, slippage, deadline, pause, multicall |

```bash
forge test --match-test invariant_
```

---

## Further reading

- Paradigm Orbital paper — https://www.paradigm.xyz/2025/06/orbital
- Uniswap V3 whitepaper — architectural reference
- [../simulation/](../simulation/) — Python reference implementation
