<p align="center">
  <img src="public/logo.png" alt="Orbital AMM Logo"/>
</p>

# Orbital 

Orbital AMM is an innovative automated market maker (AMM) that extends Uniswap V3's concentrated liquidity concept to multi-asset stablecoin pools. Based on the Paradigm Orbital paper, it uses geometric invariants to enable efficient trading across N assets while providing superior capital efficiency and depeg protection.

## Key Features

- **Multi-Asset Trading**: Support for N stablecoins in a single pool (vs Uniswap's 2 assets)
- **Concentrated Liquidity**: Liquidity providers can set custom depeg protection levels
- **Geometric Invariants**: Sphere and torus mathematics ensure price accuracy
- **Capital Efficiency**: Up to 2x more efficient than traditional AMMs
- **Depeg Isolation**: One asset depegging doesn't affect others

## Repository Structure

- `contracts/`: Solidity implementation with Foundry
- `simulation/`: Python math verification and notebooks
- `readme.md`: This introduction

## Getting Started

See the individual READMEs in each folder for setup instructions.