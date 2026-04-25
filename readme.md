# Orbital

A complete implementation of the [Paradigm Orbital paper](https://www.paradigm.xyz/2025/06/orbital) in Solidity and Python — a higher-dimensional AMM for pools of 2, 3, or N stablecoins.

Orbital is built on the Sphere AMM invariant:

$$\|\mathbf{r} - \mathbf{x}\|^2 = \sum_{i=1}^{n}(r - x_i)^2 = r^2$$

where $x_i$ is the pool's reserve of asset $i$. Tick boundaries are orbits around the equal $1 price point. Each tick has two states: interior (near peg, actively earning fees) and boundary (one asset depegged, removed from that tick while others keep trading). All ticks collapse to a single toroid equation, keeping swap computation constant-time on-chain regardless of how many assets are listed.

- ~150× capital efficiency at tight peg (n=5, p=0.99)
- Depeg isolation — one asset going to zero does not affect pricing of the rest
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

https://orbital.xyz

---

## Deployed on Base Sepolia Testnet

| Contract        | Address |
| --------------- | ------- |
| Factory         | [`0x7e1B4FE6170AccA1789e249eAB3D247182D30B44`](https://sepolia.basescan.org/address/0x7e1B4FE6170AccA1789e249eAB3D247182D30B44) |
| Pool (4-asset)  | [`0x79E516819DC8c06D79615A2f2F1914c646649369`](https://sepolia.basescan.org/address/0x79E516819DC8c06D79615A2f2F1914c646649369) |
| Router          | [`0x60CEC0218b501Cf4E045CbDbA3eF021374e1aFAc`](https://sepolia.basescan.org/address/0x60CEC0218b501Cf4E045CbDbA3eF021374e1aFAc) |
| PositionManager | [`0x08AC49be269F1c6C2821D56c4C729C9843152EE3`](https://sepolia.basescan.org/address/0x08AC49be269F1c6C2821D56c4C729C9843152EE3) |
| Quoter          | [`0x713cd4D1a453705fa31D81A89817174d1c37d489`](https://sepolia.basescan.org/address/0x713cd4D1a453705fa31D81A89817174d1c37d489) |
| MockUSDC        | [`0x44406ad771b05827F5fd95b002189e51EEbEDC91`](https://sepolia.basescan.org/address/0x44406ad771b05827F5fd95b002189e51EEbEDC91) |
| MockUSDT        | [`0x168DEB69184ea184AadB8a626DC4d3013dc08Fe8`](https://sepolia.basescan.org/address/0x168DEB69184ea184AadB8a626DC4d3013dc08Fe8) |
| MockDAI         | [`0x60Cb112631Ce92f9fe164878d690FAc1FD1C295d`](https://sepolia.basescan.org/address/0x60Cb112631Ce92f9fe164878d690FAc1FD1C295d) |
| MockFRAX        | [`0x39855B7DE333de50A7b2e97a3A3E2Ec1CF0411a9`](https://sepolia.basescan.org/address/0x39855B7DE333de50A7b2e97a3A3E2Ec1CF0411a9) |

---

## References

- Paradigm Orbital paper — https://www.paradigm.xyz/2025/06/orbital
- [contracts/README.md](contracts/README.md) — contract reference and integration guide
