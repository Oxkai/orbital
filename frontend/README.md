# Orbital — Frontend

Marketing site for the [Orbital AMM](../README.md). Built with Next.js 16, React 19, and Tailwind CSS 4. Deployed at **https://orbital.xyz**.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Styling | Tailwind CSS 4 + inline design tokens |
| Fonts | Roboto (sans) · Geist Mono |
| Animations | Framer Motion |
| Icons | Lucide React |

## Structure

```
app/
  layout.tsx        # Root layout — fonts, theme CSS vars, dev grid overlay
  page.tsx          # Home page — assembles all sections
components/
  home/
    Masthead.tsx    # Hero + intro copy + index
    Pillars.tsx     # Three principles (low slippage, capital efficiency, depeg isolation)
    Mechanics.tsx   # Sphere / Ticks / Torus cards
    VsTable.tsx     # Comparison table vs Uniswap V3, Curve, Balancer
    Deployed.tsx    # On-chain contract registry (Base Sepolia)
    References.tsx  # Paper and contract links
  layout/
    Nav.tsx         # Sticky nav — logo, dark/light toggle, "Launch App" button
    Footer.tsx      # Footer
    LayoutGrid.tsx  # Dev-only 12-col grid overlay
constants/
  colors.ts         # Color palette + per-theme CSS variable maps
  typography.ts     # Type scale
  index.ts          # Re-exports + theme helpers
```

## Dev

```bash
npm install
npm run dev       # http://localhost:3000
npm run build
npm run lint
```

Theme (dark/light) is toggled via the Nav button; the preference is saved to `localStorage` and applied as CSS variables on `<html>`.
