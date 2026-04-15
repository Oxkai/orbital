# Orbital

<p align="center">
  <img src="public/logo.png" alt="Orbital AMM Logo"/>
</p>

Orbital is a multi-asset stablecoin automated market maker. It generalises
Uniswap V3's concentrated-liquidity model from two tokens to **N
stablecoins in a single pool**, using the sphere and torus invariants
introduced in the
[Paradigm Orbital paper](https://www.paradigm.xyz/2025/06/orbital).

Liquidity providers choose a per-position depeg-protection level. While
every asset trades near its peg, capital is highly concentrated and swaps
execute at near-flat prices. When a single asset starts to depeg, the
affected position is automatically pinned at the boundary of its range
and the remaining pool continues to serve trades between the healthy
assets.

This repository contains the full Solidity implementation, a Python
reference implementation used to validate the math against the paper, and
a Foundry test suite covering unit, fuzz, and stateful invariant tests.

---

## Table of contents

- [Paper goals delivered](#paper-goals-delivered)
- [Why another AMM?](#why-another-amm)
- [How it works](#how-it-works)
- [Comparison with existing designs](#comparison-with-existing-designs)
- [Repository layout](#repository-layout)
- [Quick start](#quick-start)
- [Using the protocol](#using-the-protocol)
- [Implementation notes](#implementation-notes)
- [Status](#status)
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

## Deployed on Base Sepolia

All contracts are live and verified on BaseScan (chain id `84532`).

| Contract           | Address                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Factory            | [`0x7e1B4FE6170AccA1789e249eAB3D247182D30B44`](https://sepolia.basescan.org/address/0x7e1B4FE6170AccA1789e249eAB3D247182D30B44) |
| Pool (4-asset, 0.3%) | [`0x79E516819DC8c06D79615A2f2F1914c646649369`](https://sepolia.basescan.org/address/0x79E516819DC8c06D79615A2f2F1914c646649369) |
| Router             | [`0x60CEC0218b501Cf4E045CbDbA3eF021374e1aFAc`](https://sepolia.basescan.org/address/0x60CEC0218b501Cf4E045CbDbA3eF021374e1aFAc) |
| PositionManager    | [`0x08AC49be269F1c6C2821D56c4C729C9843152EE3`](https://sepolia.basescan.org/address/0x08AC49be269F1c6C2821D56c4C729C9843152EE3) |
| Quoter             | [`0x713cd4D1a453705fa31D81A89817174d1c37d489`](https://sepolia.basescan.org/address/0x713cd4D1a453705fa31D81A89817174d1c37d489) |
| MockUSDC           | [`0x44406ad771b05827F5fd95b002189e51EEbEDC91`](https://sepolia.basescan.org/address/0x44406ad771b05827F5fd95b002189e51EEbEDC91) |
| MockUSDT           | [`0x168DEB69184ea184AadB8a626DC4d3013dc08Fe8`](https://sepolia.basescan.org/address/0x168DEB69184ea184AadB8a626DC4d3013dc08Fe8) |
| MockDAI            | [`0x60Cb112631Ce92f9fe164878d690FAc1FD1C295d`](https://sepolia.basescan.org/address/0x60Cb112631Ce92f9fe164878d690FAc1FD1C295d) |
| MockFRAX           | [`0x39855B7DE333de50A7b2e97a3A3E2Ec1CF0411a9`](https://sepolia.basescan.org/address/0x39855B7DE333de50A7b2e97a3A3E2Ec1CF0411a9) |

Pool state after seeding:

- 4 LP positions at `k_norm ∈ {1.050, 1.150, 1.275, 1.375}`
- 20 cross-pair swaps executed; torus invariant held on every swap
- Reserves ≈ 500k of each token
- Total deployment + seed cost: ~0.0004 ETH

---

## Why another AMM?

Existing stablecoin AMMs trade off between three properties:

1. **Capital efficiency near peg.** Uniswap V3 gives tight ranges but only
   over token *pairs*.
2. **N-asset support.** Curve StableSwap and Balancer handle N tokens but
   spread liquidity over the entire price domain, so most of the pool is
   idle.
3. **Depeg safety.** When one asset breaks peg, most pooled designs let
   it drain the rest of the pool before arbitrage closes the gap.

Orbital pursues all three at once. It generalises V3's geometric,
range-based liquidity from a line segment (on `x·y=k`) to the surface of
a sphere in N dimensions, so a single pool can list any number of
stablecoins with per-LP depeg bounds, and the math naturally contains a
depegging asset inside its own tick.

---

## How it works

### Reserves live on a sphere

The pool tracks its reserves as a vector `x = (x₁, …, x_n)` in
N-dimensional space. Liquidity is described by a single invariant:

```
‖x − r·1̂‖² = r²        where 1̂ = (1, 1, …, 1)
```

Geometrically this is a **sphere of radius `r` centred at `(r, r, …, r)`**.
Every point on the sphere is a valid reserve state. The equal-price point
`(q, q, …, q)` where `q = r(1 − 1/√n)` sits on the sphere and is the
"all pegged" state.

Swapping from asset `i` to asset `j` moves the reserve vector along the
sphere: `xᵢ` rises, `xⱼ` falls, and the amount out is determined by
solving the sphere equation for the new `xⱼ`.

### Concentrated liquidity via plane ticks

A V3 position lives between two price ticks. An Orbital position lives
between two **planes**. Each LP picks a plane constant `k`:

```
xᵢ · 1̂ = k
```

When the reserve vector is on the "interior" side of the plane, the
position is active — its radius `r` contributes to the pool's
`rInt` and receives swap fees. When the reserve vector crosses the plane,
the tick flips to the **boundary** state: its radius is removed from
`rInt` and the position only earns fees if a future swap pushes prices
back inside.

The `k` constant encodes the depeg tolerance. Tight ticks (`k` close to
`kMin`) give high capital efficiency but flip to boundary at small
depegs. Wide ticks (`k` close to `kMax`) stay interior even under heavy
depeg stress but behave like a flat curve.

### Torus invariant (combining many ticks)

When multiple positions are stacked at different `k` values, the total
state is described by the intersection of the sphere with the stack of
tick planes. This intersection is a **torus**, and the pool stores its
parameters in hot `slot0` storage:

```
sumX     = Σ xᵢ
sumXSq   = Σ xᵢ²
rInt     = Σ r over interior ticks
kBound   = Σ k over boundary ticks
sBound   = Σ s over boundary ticks
```

Every mint, swap, and burn verifies

```
torus_LHS(sumX, sumXSq, rInt, kBound, sBound, n) ≈ rInt²
```

to within 1 ppm of relative drift. A failing check reverts the transaction.

### Swap algorithm

Given an `assetIn → assetOut` trade of size `Δin`:

1. **Fee split.** `fee = Δin · feeTier / 1e6` is moved into the fee
   bucket for `assetIn` and credited to interior LPs via `feeGrowthGlobal`.
2. **Tentative Newton solve.** `TorusMath.solveSwap` runs up to 15 Newton
   iterations on the torus equation to find the new `xⱼ` (and hence
   `Δout`).
3. **Tick-crossing detection.** The pool compares `αNorm` before and
   after the tentative trade against every tick's normalised plane
   constant `kNorm`. If any `kNorm` was crossed, the trade is split at
   the boundary using a closed-form quadratic, the tick flips state, and
   the loop continues with the remaining input. Capped at 10 crossings
   per swap.
4. **Invariant check.** Before transferring output, the torus invariant
   is re-evaluated on the resulting state. Any drift above 1 ppm
   reverts.
5. **Callback transfer-in.** Output is sent first; the caller's swap
   callback pulls the input tokens. The pool verifies its own balance
   increased by at least `Δin`.

### Depeg isolation in one picture

When `xᵢ / Σx` drifts far from `1/n`, the ticks closest to peg flip to
boundary one by one. Their liquidity stops being consumed, so the
depegging asset runs out of counterparty on tight ticks and only the
wide, backstop ticks remain engaged. The price of the healthy pairs is
barely perturbed.

---

## Comparison with existing designs

| Property                              | Uniswap V3  | Curve StableSwap | Balancer Stable | **Orbital**     |
| ------------------------------------- | ----------- | ---------------- | --------------- | --------------- |
| Number of assets per pool             | 2           | 2–8 (fixed)      | 2–8 (fixed)     | **N (≥ 2)**     |
| Concentrated liquidity                | Yes         | No               | No              | **Yes**         |
| Per-LP depeg range                    | n/a         | No               | No              | **Yes**         |
| Depeg of one asset drains pool?       | n/a         | Yes, until A→0   | Yes             | **Isolated**    |
| Capital efficiency at tight peg       | High (pair) | ~1–2× flat       | ~1–2× flat      | **~2× flat, N** |
| TWAP oracle                           | Yes         | No (external)    | Yes             | **Yes**         |
| NFT positions                         | Yes         | No               | No              | **Yes**         |
| Callback-based mint / swap            | Yes         | No               | No              | **Yes**         |

Key takeaway: Orbital is the first design that combines V3-style
range-concentrated liquidity with N-asset pools and asset-level depeg
containment.

---

## Repository layout

```
O/
├── contracts/    Foundry project — factory, pool, router, quoter,
│                 position manager, oracle, and tests
├── simulation/   Python reference implementation (Decimal-based) used
│                 to validate the Solidity math against the paper
├── public/       Assets
└── readme.md
```

- [contracts/README.md](contracts/README.md) — build, test, deployment,
  and integration guide.

---

## Quick start

```bash
cd contracts
forge build
forge test
```

A local deployment with a seeded pool and a scripted depeg simulation is
documented in
[contracts/README.md](contracts/README.md#local-deploy--seed).

---

## Using the protocol

Swap via the router:

```solidity
router.exactInput(OrbitalRouter.SwapParams({
    pool:         poolAddr,
    assetIn:      0,                 // index into pool.tokens()
    assetOut:     1,
    amountIn:     1_000e18,
    amountOutMin: 990e18,
    recipient:    msg.sender,
    deadline:     block.timestamp + 300
}));
```

Add liquidity via the position manager:

```solidity
uint256 k = TickLib.kMin(rWad, n) + depegBuffer;

positionManager.mint(OrbitalPositionManager.MintParams({
    pool:       poolAddr,
    kWad:       k,
    rWad:       100_000e18,
    amountsMin: new uint256[](n),
    recipient:  msg.sender,
    deadline:   block.timestamp + 300
}));
```

Each position is an ERC-721; the standard V3 lifecycle (`increaseLiquidity`,
`decreaseLiquidity`, `collect`, `burn`) is supported. Full snippets and
multicall usage live in
[contracts/README.md](contracts/README.md#using-the-protocol).

---

## Implementation notes

- **Precision.** All pool values are WAD-scaled (1e18). Every
  multiplication that could overflow 256 bits goes through `FullMath.mulDiv`
  (Uniswap's 512-bit helper).
- **Decimal enforcement.** The factory rejects tokens whose
  `decimals()` is not 18 so that callback transfer amounts remain
  consistent with on-chain pool state.
- **Reentrancy.** Every state-changing entrypoint on the pool is guarded
  by a single `lock` modifier backed by `slot0.unlocked`.
- **Oracle.** Uses the Uniswap V3 ring-buffer layout with 65,535 slots.
  Observations track `sumX` and `sumXSq` instead of `sqrtPrice`.
- **Emergency pause.** The factory owner can halt `mint`/`swap`/`burn`
  across every pool via `setPaused(bool)`. `collect` deliberately stays
  open so LPs can always withdraw credited fees.
- **No protocol fee, no upgradeability, no native ETH, no flash loans**
  in the prototype surface.
- **Python / Solidity parity.** The
  [simulation/](simulation/) scripts use 78-digit `Decimal` arithmetic
  to reproduce the same invariants as the on-chain code, letting any
  Solidity result be cross-checked against the paper.

---

## Features

- N-stablecoin pools in a single pool (n ≥ 2)
- Per-LP depeg-protection range
- Depeg isolation — one stablecoin breaking peg does not drain the others
- Multi-tick swaps across stacked liquidity ranges
- ERC-721 LP positions
- Router, quoter, and TWAP oracle on pool reserves
- Emergency pause

The full Foundry suite (unit, fuzz, and invariant tests) passes on
`forge test` — 134 tests across 8 suites.

## References

- Paradigm Orbital paper — https://www.paradigm.xyz/2025/06/orbital
- Uniswap V3 whitepaper — architectural reference
- [contracts/README.md](contracts/README.md) — build, test, deployment,
  and integration guide
