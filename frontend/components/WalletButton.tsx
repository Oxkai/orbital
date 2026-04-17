"use client";

import { useAccount, useConnect, useDisconnect, useBalance } from "wagmi";
import { useState } from "react";
import { baseSepolia } from "wagmi/chains";

export function WalletButton() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  const { data: balance } = useBalance({
    address,
    chainId: baseSepolia.id,
  });

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";
  const wrongChain = isConnected && chain?.id !== baseSepolia.id;

  if (isConnected) {
    return (
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded font-mono text-[10px] transition-all duration-150 ${
            wrongChain
              ? "text-red-400"
              : "text-secondary hover:text-primary"
          }`}
          style={{ background: "var(--color-surface)" }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${wrongChain ? "bg-red-400" : "bg-green-400"}`} />
          {wrongChain ? "wrong network" : short}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div
              className="absolute right-0 mt-1 z-20 w-52 rounded-md overflow-hidden shadow-sm"
              style={{ background: "var(--color-surface)" }}
            >
              <div className="px-3 py-2.5">
                <p className="text-[9px] font-mono text-tertiary uppercase tracking-widest">connected</p>
                <p className="text-xs font-mono text-primary mt-0.5">{short}</p>
                {balance && (
                  <p className="text-[10px] font-mono text-tertiary mt-0.5">
                    {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
                  </p>
                )}
                <p className="text-[9px] font-mono text-tertiary mt-0.5">Base Sepolia</p>
              </div>
              <button
                onClick={() => { disconnect(); setOpen(false); }}
                className="w-full px-3 py-2 text-left text-[11px] font-mono text-tertiary hover:text-primary transition-colors"
              >
                disconnect
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
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-primary text-background font-mono text-[10px] hover:opacity-90 transition-all duration-150"
      >
        {isPending ? "connecting…" : "connect wallet"}
      </button>

      {open && !isPending && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-1 z-20 w-44 rounded-md overflow-hidden shadow-sm"
            style={{ background: "var(--color-surface)" }}
          >
            {connectors.map((c) => (
              <button
                key={c.id}
                onClick={() => { connect({ connector: c, chainId: baseSepolia.id }); setOpen(false); }}
                className="w-full px-3 py-2.5 text-left text-[11px] font-mono text-tertiary hover:text-primary transition-colors"
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
