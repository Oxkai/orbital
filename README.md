# Orbital

<p align="center">
  <img src="public/logo.png" alt="Orbital AMM Logo"/>
</p>

Orbital is a multi-asset stablecoin automated market maker. It generalises
Uniswap V3's concentrated-liquidity model from two tokens to **N stablecoins
in a single pool**, using the sphere and torus invariants introduced in the
[Paradigm Orbital paper](https://www.paradigm.xyz/2025/06/orbital).

Liquidity providers choose a per-position depeg-protection level. While every
asset trades near its peg, capital is highly concentrated and swaps execute at
near-flat prices. When a single asset starts to depeg, the affected position is
automatically pinned at the boundary of its range and the remaining pool
continues to serve trades between the healthy assets.

---

## Table of contents

- [Paper goals delivered](#paper-goals-delivered)
- [Why another AMM?](#why-another-amm)
- [How it works](#how-it-works)
- [Comparison with existing designs](#comparison-with-existing-designs)
- [Repository layout](#repository-layout)
- [Deployed on Base Sepolia](#deployed-on-base-sepolia)
- [Quick start](#quick-start)
- [References](#references)

---

## Paper goals delivered

Every headline property from the [Paradigm Orbital paper](https://www.paradigm.xyz/2025/06/orbital)
is implemented and verified against the paper's own numbers.

| Goal (from paper)                    | Paper claim              | Measured in this repo      |
| ------------------------------------ | ------------------------ | -------------------------- |
| **Capital efficiency** (n=5, p=0.90) | ~15× vs flat sphere      | **15.31×**                 |
| **Capital efficiency** (n=5, p=0.99) | ~150× vs flat sphere     | **154.36×**                |
| **Low slippage near peg**            | Concentrated liquidity   | **~1/154th** of flat-AMM impact at p=0.99 |
| **Depeg isolation**                  | Tight ticks flip to boundary when one asset depegs | `test_depeg_scenario` — 50 one-directional swaps, all ticks boundary, healthy assets keep trading |
| **N-asset support**                  | "2, 3, or 10,000"        | n set at pool creation; tested n = 2, 3, 4, 5, 10 |
| **Torus invariant**                  | `LHS ≈ rInt²` (§4.11)    | Checked after every mint / swap / burn, 1 ppm tolerance |
| **Tick-crossing trade**              | Quadratic crossover (§13)| Closed-form solve + Newton refinement; up to 10 crossings/swap |
| **On-chain efficiency**              | Constant-time via `sumX`, `sumXSq` tracking | Implemented in `slot0`; swap gas ~250-400k across crossings |

The 154× capital-efficiency figure means that at a 0.99 depeg tolerance a
1 USDC swap in a 5-asset Orbital pool sees roughly **1/154th** the price
impact of the same trade on a plain sphere AMM with the same reserves.

---

## Why another AMM?

Existing stablecoin AMMs trade off between three properties:

1. **Capital efficiency near peg.** Uniswap V3 gives tight ranges but only
   over token *pairs*.
2. **N-asset support.** Curve StableSwap and Balancer handle N tokens but
   spread liquidity over the entire price domain, so most of the pool is idle.
3. **Depeg safety.** When one asset breaks peg, most pooled designs let it
   drain the rest of the pool before arbitrage closes the gap.

Orbital pursues all three at once. It generalises V3's geometric, range-based
liquidity from a line segment (on `x·y=k`) to the surface of a sphere in N
dimensions, so a single pool can list any number of stablecoins with per-LP
depeg bounds, and the math naturally contains a depegging asset inside its own
tick.

---

## How it works

### Reserves live on a sphere

The pool tracks its reserves as a vector `x = (x₁, …, x_n)` in N-dimensional
space. Liquidity is described by a single invariant:

```
‖x − r·1̂‖² = r²        where 1̂ = (1, 1, …, 1)
```

This is a **sphere of radius `r` centred at `(r, r, …, r)`**. The equal-price
point `(q, q, …, q)` where `q = r(1 − 1/√n)` sits on the sphere and is the
"all pegged" state. Swapping asset `i` for asset `j` moves the reserve vector
along the sphere.

### Concentrated liquidity via plane ticks

Each LP picks a plane constant `k` (the depeg tolerance). When the reserve
vector is on the interior side of the plane the position is active — its radius
`r` contributes to `rInt` and receives fees. When the vector crosses the plane,
the tick flips to **boundary**: liquidity is removed from `rInt` and the
depegging asset stops consuming counterparty from that position.

Tight ticks (`k` near `kMin`) give high capital efficiency but flip quickly.
Wide ticks (`k` near `kMax`) act as a backstop and stay interior under heavy
depeg stress.

### Torus invariant

When multiple positions are stacked at different `k` values, the pool state
lives on a torus. `slot0` stores five aggregates (`sumX`, `sumXSq`, `rInt`,
`kBound`, `sBound`) that let every mint, swap, and burn verify the invariant
in O(1) without iterating over all ticks.

---

## Comparison with existing designs

| Property                              | Uniswap V3  | Curve StableSwap | Balancer Stable | **Orbital**     |
| ------------------------------------- | ----------- | ---------------- | --------------- | --------------- |
| Number of assets per pool             | 2           | 2–8 (fixed)      | 2–8 (fixed)     | **N (≥ 2)**     |
| Concentrated liquidity                | Yes         | No               | No              | **Yes**         |
| Per-LP depeg range                    | n/a         | No               | No              | **Yes**         |
| Depeg of one asset drains pool?       | n/a         | Yes, until A→0   | Yes             | **Isolated**    |
| Capital efficiency at tight peg       | High (pair) | ~1–2× flat       | ~1–2× flat      | **~154× flat, N=5** |
| TWAP oracle                           | Yes         | No (external)    | Yes             | **Yes**         |
| NFT positions                         | Yes         | No               | No              | **Yes**         |
| Callback-based mint / swap            | Yes         | No               | No              | **Yes**         |

---

## Repository layout

```
O/
├── contracts/    Foundry project — factory, pool, router, quoter,
│                 position manager, oracle, math libs, and tests
├── simulation/   Python reference implementation used to validate
│                 the Solidity math against the paper
├── frontend/     Next.js interface — swap widget and pool visualiser
├── public/       Assets (logo)
└── README.md
```

- [contracts/README.md](contracts/README.md) — build, test, deploy, contract
  reference, and integration guide
- [frontend/](frontend/) — Next.js app (Wagmi + RainbowKit, Base Sepolia)

---

## Deployed on Base Sepolia

All contracts are live and verified on BaseScan (chain id `84532`).

| Contract             | Address |
| -------------------- | ------- |
| Factory              | [`0x7e1B4FE6170AccA1789e249eAB3D247182D30B44`](https://sepolia.basescan.org/address/0x7e1B4FE6170AccA1789e249eAB3D247182D30B44) |
| Pool (4-asset, 0.3%) | [`0x79E516819DC8c06D79615A2f2F1914c646649369`](https://sepolia.basescan.org/address/0x79E516819DC8c06D79615A2f2F1914c646649369) |
| Router               | [`0x60CEC0218b501Cf4E045CbDbA3eF021374e1aFAc`](https://sepolia.basescan.org/address/0x60CEC0218b501Cf4E045CbDbA3eF021374e1aFAc) |
| PositionManager      | [`0x08AC49be269F1c6C2821D56c4C729C9843152EE3`](https://sepolia.basescan.org/address/0x08AC49be269F1c6C2821D56c4C729C9843152EE3) |
| Quoter               | [`0x713cd4D1a453705fa31D81A89817174d1c37d489`](https://sepolia.basescan.org/address/0x713cd4D1a453705fa31D81A89817174d1c37d489) |
| MockUSDC             | [`0x44406ad771b05827F5fd95b002189e51EEbEDC91`](https://sepolia.basescan.org/address/0x44406ad771b05827F5fd95b002189e51EEbEDC91) |
| MockUSDT             | [`0x168DEB69184ea184AadB8a626DC4d3013dc08Fe8`](https://sepolia.basescan.org/address/0x168DEB69184ea184AadB8a626DC4d3013dc08Fe8) |
| MockDAI              | [`0x60Cb112631Ce92f9fe164878d690FAc1FD1C295d`](https://sepolia.basescan.org/address/0x60Cb112631Ce92f9fe164878d690FAc1FD1C295d) |
| MockFRAX             | [`0x39855B7DE333de50A7b2e97a3A3E2Ec1CF0411a9`](https://sepolia.basescan.org/address/0x39855B7DE333de50A7b2e97a3A3E2Ec1CF0411a9) |

Pool seeded with 4 LP positions at `k_norm ∈ {1.050, 1.150, 1.275, 1.375}`,
20 cross-pair swaps executed, reserves ≈ 500k of each token.

---

## Quick start

```bash
cd contracts
forge build
forge test
```

For local deployment, integration snippets, and the full contract reference see
[contracts/README.md](contracts/README.md).

---

## References

- Paradigm Orbital paper — https://www.paradigm.xyz/2025/06/orbital
- Uniswap V3 whitepaper — architectural reference
- [contracts/README.md](contracts/README.md) — full contract and integration guide
