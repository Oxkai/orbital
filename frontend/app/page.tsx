"use client";

import SimulationPanel from "@/components/SimulationPanel";
import SwapWidget from "@/components/SwapWidget";
import { ThemeToggle } from "@/components/ThemeProvider";
import { WalletButton } from "@/components/WalletButton";
import { usePoolData } from "@/lib/usePoolData";

export default function Home() {
  const pool = usePoolData();

  const reserves = pool.isLoading || pool.reserves.USDC === 0
    ? { USDC: 60, DAI: 80, FRAX: 40, USDT: 70 }
    : pool.reserves;

  const radius = pool.rInt > 0 ? pool.rInt : 100;

  return (
    <main className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--color-background)" }}>

      {/* ── Nav ── */}
      <header
        className="shrink-0 flex items-center justify-between px-6 h-14"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center"
            style={{ background: "var(--color-accent)" }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="3.5" stroke="white" strokeWidth="1.4" />
              <circle cx="5" cy="5" r="1" fill="white" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--color-primary)" }}>
            Orbital
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: "var(--color-accent-dim)", color: "var(--color-accent)" }}
          >
            AMM
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          {[
            { label: "Simulate", active: false },
            { label: "Swap",     active: true  },
            { label: "Docs",     active: false },
          ].map(({ label, active }) => (
            <button
              key={label}
              className="px-3 py-1.5 rounded-md text-[11px] font-mono transition-all duration-150"
              style={{
                background: active ? "var(--color-surface-alt)" : "transparent",
                color: active ? "var(--color-primary)" : "var(--color-tertiary)",
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex min-h-0 gap-0">

        {/* Simulation panel */}
        <div className="flex-1 flex flex-col min-h-0 p-4">
          <SimulationPanel
            radius={radius}
            reserves={reserves}
            ticks={pool.ticks}
            nAssets={pool.n}
            size={480}
          />
        </div>

        {/* Divider */}
        <div className="shrink-0 w-px self-stretch" style={{ background: "var(--color-border)" }} />

        {/* Swap panel */}
        <div className="w-[360px] shrink-0 flex flex-col min-h-0">
          {/* Swap panel header */}
          <div
            className="shrink-0 px-5 h-11 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            <span className="text-[11px] font-mono font-medium tracking-widest uppercase" style={{ color: "var(--color-primary)" }}>
              Swap
            </span>
            <span className="text-[10px] font-mono" style={{ color: "var(--color-tertiary)" }}>
              Base Sepolia
            </span>
          </div>

          {/* Swap content */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <SwapWidget />
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        className="shrink-0 px-6 h-9 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--color-border)" }}
      >
        <span className="text-[10px] font-mono" style={{ color: "var(--color-muted)" }}>
          © 2025 Orbital · Built on{" "}
          <span style={{ color: "var(--color-tertiary)" }}>Paradigm research</span>
        </span>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded"
          style={{
            background: "var(--color-surface-alt)",
            color: "var(--color-tertiary)",
          }}
        >
          (r−x₁)² + (r−x₂)² = r²
        </span>
      </footer>

    </main>
  );
}
