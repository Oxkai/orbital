"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { useState } from "react";
import { baseSepolia } from "wagmi/chains";

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  const { data: balance } = useBalance({ address, chainId: baseSepolia.id });

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
  const wrongChain = isConnected && chain?.id !== baseSepolia.id;

  if (isConnected) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-mono transition-all duration-150 hover:opacity-80"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            color: wrongChain ? "#f87171" : "var(--color-secondary)",
          }}
        >
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: wrongChain ? "#f87171" : "#4ade80" }}
          />
          {wrongChain ? "Wrong Network" : short}
          <svg width="7" height="5" viewBox="0 0 7 5" fill="none" style={{ color: "var(--color-tertiary)" }}>
            <path d="M1 1l2.5 2L6 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div
              className="absolute right-0 mt-1.5 z-20 w-56 rounded-xl overflow-hidden"
              style={{
                background: "var(--color-surface-alt)",
                border: "1px solid var(--color-border)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
                <p className="text-[9px] font-mono tracking-widest uppercase mb-1.5" style={{ color: "var(--color-tertiary)" }}>
                  Connected
                </p>
                <p className="text-[13px] font-mono font-medium" style={{ color: "var(--color-primary)" }}>
                  {short}
                </p>
                {balance && (
                  <p className="text-[11px] font-mono mt-1" style={{ color: "var(--color-secondary)" }}>
                    {(Number(balance.value) / 1e18).toFixed(4)}{" "}
                    <span style={{ color: "var(--color-tertiary)" }}>{balance.symbol}</span>
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#4ade80" }}
                  />
                  <p className="text-[10px] font-mono" style={{ color: "var(--color-tertiary)" }}>
                    Base Sepolia
                  </p>
                </div>
              </div>
              <button
                onClick={() => { disconnect(); setOpen(false); }}
                className="w-full px-4 py-3 text-left text-[11px] font-mono transition-all hover:opacity-70"
                style={{ color: "#f87171" }}
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-mono font-medium transition-all duration-150 hover:opacity-90 active:scale-[0.98]"
        style={{
          background: "var(--color-primary)",
          color: "var(--color-background)",
        }}
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>

      {open && !isPending && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-1.5 z-20 w-48 rounded-xl overflow-hidden py-1.5"
            style={{
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-border)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            <p className="px-4 py-1.5 text-[9px] font-mono tracking-widest uppercase" style={{ color: "var(--color-tertiary)" }}>
              Select wallet
            </p>
            {connectors.map((c) => (
              <button
                key={c.id}
                onClick={() => { connect({ connector: c, chainId: baseSepolia.id }); setOpen(false); }}
                className="w-full px-4 py-2.5 text-left text-[12px] font-mono transition-all hover:opacity-70"
                style={{ color: "var(--color-secondary)" }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
