# Orbital

A complete implementation of the [Paradigm Orbital paper](https://www.paradigm.xyz/2025/06/orbital) in Solidity and Python — a higher-dimensional AMM for pools of 2, 3, or N stablecoins.

Orbital is built on the Sphere AMM invariant:

$$\|\mathbf{r} - \mathbf{x}\|^2 = \sum_{i=1}^{n}(r - x_i)^2 = r^2$$

where $x_i$ is the pool's reserve of asset $i$. Tick boundaries are orbits around the equal $1 price point. Each tick has two states: interior (near peg, actively earning fees) and boundary (one asset depegged, removed from that tick while others keep trading). All ticks collapse to a single toroid equation, keeping swap computation constant-time on-chain regardless of how many assets are listed.

- ~150× capital efficiency at tight peg (n=5, p=0.99)
- One asset going to zero does not affect pricing of the rest
- Near-zero slippage — ~1/154th the price impact of a flat AMM at p=0.99
- Per-LP tick selection — each LP independently sets their depeg tolerance, from narrow (max efficiency) to wide (volatility backstop)

---

## Architecture

```
Orbital/
├── contracts/          # On-chain — pool, factory, router, quoter, position manager
├── frontend/           # UI — swap interface and pool visualiser (Next.js, Base Sepolia)
└── simulation/         # Math — Python reference implementation, paper validation
```

Each folder has its own README with build instructions and detailed documentation.

---

## Live Demo

https://0rbital.live

---

## Deployed on Base Sepolia Testnet

| Contract        | Address |
| --------------- | ------- |
| Factory         | [`0xe9b2486b38609bb090a7c9ce944e36caca9117eb`](https://sepolia.basescan.org/address/0xe9b2486b38609bb090a7c9ce944e36caca9117eb) |
| Pool (4-asset)  | [`0xf250ecbe26adc1c03cbffff6af9d20bcaaf6e4e0`](https://sepolia.basescan.org/address/0xf250ecbe26adc1c03cbffff6af9d20bcaaf6e4e0) |
| Router          | [`0x46831b7178bb1719bc9ec9ff6038a4f44b1106da`](https://sepolia.basescan.org/address/0x46831b7178bb1719bc9ec9ff6038a4f44b1106da) |
| PositionManager | [`0x7a3558170ae4a15523d1e2848aa41aed1c7fa292`](https://sepolia.basescan.org/address/0x7a3558170ae4a15523d1e2848aa41aed1c7fa292) |
| Quoter          | [`0x18033e198a2b0af2afa75afcc520f42179955a68`](https://sepolia.basescan.org/address/0x18033e198a2b0af2afa75afcc520f42179955a68) |
| MockUSDC        | [`0x9aeb218e9f3e4f2366f4a09a9d33823a8856d192`](https://sepolia.basescan.org/address/0x9aeb218e9f3e4f2366f4a09a9d33823a8856d192) |
| MockUSDT        | [`0x7d1c2f283811a0aa7d538e3c859da8bb45330e35`](https://sepolia.basescan.org/address/0x7d1c2f283811a0aa7d538e3c859da8bb45330e35) |
| MockDAI         | [`0x31f54f08c8df97d934b6804fab69c98c09898fb9`](https://sepolia.basescan.org/address/0x31f54f08c8df97d934b6804fab69c98c09898fb9) |
| MockFRAX        | [`0xda585869c1b63f20cb54226cd99b006d90bad784`](https://sepolia.basescan.org/address/0xda585869c1b63f20cb54226cd99b006d90bad784) |
| MockcrvUSD      | [`0xf27a032aa39d559801ddabf6f65e4db597f26ccd`](https://sepolia.basescan.org/address/0xf27a032aa39d559801ddabf6f65e4db597f26ccd) |

---

## References

- Paradigm Orbital paper — https://www.paradigm.xyz/2025/06/orbital
- [contracts/README.md](contracts/README.md) — contract reference and integration guide
