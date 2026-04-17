"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuote, useAllowance, useApprove, useExactInput, type SwapCoin } from "@/lib/useSwap";

const COINS: SwapCoin[] = ["USDC", "DAI", "FRAX", "USDT"];
const TABS = ["Swap", "Send", "Buy"] as const;
type Tab = (typeof TABS)[number];

function CoinSelector({ coin, onSelect }: { coin: SwapCoin; onSelect: (c: SwapCoin) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-secondary hover:text-primary transition-all duration-150"
        style={{ background: "var(--color-surface-alt)" }}
      >
        {coin}
        <svg width="7" height="4" viewBox="0 0 7 4" fill="none" className="text-tertiary">
          <path d="M1 1l2.5 2L6 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-24 z-20 rounded-md overflow-hidden shadow-sm"
            style={{ background: "var(--color-surface-alt)" }}>
            {COINS.map((c) => (
              <button key={c} onClick={() => { onSelect(c); setOpen(false); }}
                className={`w-full px-3 py-2 text-left text-[11px] font-mono transition-colors ${
                  c === coin ? "text-primary" : "text-tertiary hover:text-secondary"
                }`}>
                {c}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Panel({
  label, amount, usd, coin, balance, onAmountChange, onCoinChange, showMax, readOnly, isLoading,
}: {
  label: string; amount: string; usd: string; coin: SwapCoin;
  balance?: string; onAmountChange?: (v: string) => void;
  onCoinChange: (c: SwapCoin) => void; showMax?: boolean;
  readOnly?: boolean; isLoading?: boolean;
}) {
  return (
    <div className="rounded-md p-4 flex flex-col gap-2.5"
      style={{ background: "var(--color-surface)" }}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-tertiary uppercase tracking-widest">{label}</span>
        {balance && (
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-tertiary">{parseFloat(balance).toFixed(4)} {coin}</span>
            {showMax && (
              <button onClick={() => onAmountChange?.(balance)}
                className="px-2 py-0.5 rounded text-[8px] font-mono text-tertiary hover:text-primary uppercase tracking-widest transition-all"
                style={{ background: "var(--color-surface-alt)" }}>
                max
              </button>
            )}
          </div>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        {readOnly ? (
          <span className={`text-2xl font-mono leading-none transition-opacity ${isLoading ? "opacity-40" : "text-primary"}`}>
            {isLoading ? "…" : (amount || "0")}
          </span>
        ) : (
          <input type="number" value={amount} onChange={(e) => onAmountChange?.(e.target.value)}
            placeholder="0" className="text-2xl font-mono text-primary leading-none bg-transparent outline-none w-full" />
        )}
        <CoinSelector coin={coin} onSelect={onCoinChange} />
      </div>
      <span className="text-[10px] font-mono text-tertiary">{usd}</span>
    </div>
  );
}

export default function SwapWidget() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("Swap");
  const [coinIn,  setCoinIn]  = useState<SwapCoin>("USDC");
  const [coinOut, setCoinOut] = useState<SwapCoin>("DAI");
  const [amountIn, setAmountIn] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const { amountOut, isLoading: quoteLoading } = useQuote(coinIn, coinOut, amountIn);
  const { needsApproval, balance } = useAllowance(coinIn, amountIn);
  const { approve, isPending: approving } = useApprove(coinIn);
  const { swap, isPending: swapping } = useExactInput(coinIn, coinOut, amountIn, amountOut);

  // fee = 0.05%
  const feeAmt = amountIn && parseFloat(amountIn) > 0
    ? (parseFloat(amountIn) * 0.0005).toFixed(4)
    : "—";

  const priceImpact = amountIn && amountOut && parseFloat(amountIn) > 0
    ? Math.abs(1 - parseFloat(amountOut) / parseFloat(amountIn)) * 100
    : null;

  function handleFlip() {
    setFlipped((f) => !f);
    setCoinIn(coinOut);
    setCoinOut(coinIn);
    setAmountIn(amountOut);
    setTxHash(null);
    setTxError(null);
  }

  async function handleAction() {
    setTxHash(null);
    setTxError(null);
    try {
      if (needsApproval) {
        await approve();
      } else {
        const hash = await swap();
        if (hash) setTxHash(hash);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Transaction failed";
      setTxError(msg.includes("User rejected") ? "Rejected in wallet" : "Transaction failed");
    }
  }

  const btnLabel = () => {
    if (!isConnected)   return "connect wallet";
    if (approving)      return "approving…";
    if (swapping)       return "swapping…";
    if (needsApproval)  return `approve ${coinIn}`;
    if (!amountIn || parseFloat(amountIn) === 0) return "enter amount";
    return "swap";
  };

  const btnDisabled = isConnected && !needsApproval && (!amountIn || parseFloat(amountIn) === 0 || swapping || approving);

  return (
    <div className="w-full flex flex-col gap-3.5 select-none">

    
    

      {/* Panels */}
      <div className="flex flex-col gap-2">
        <Panel label="Sell" amount={amountIn} usd={amountIn ? `≈ $${parseFloat(amountIn).toFixed(2)}` : "$0.00"}
          coin={coinIn} balance={balance} showMax onAmountChange={setAmountIn} onCoinChange={setCoinIn} />

        <div className="flex justify-center relative z-10 -my-1">
          <button onClick={handleFlip}
            className="w-8 h-8 flex items-center justify-center rounded text-tertiary hover:text-secondary transition-all duration-200"
            style={{ background: "var(--color-background)", transform: `rotate(${flipped ? 180 : 0}deg)`, transition: "transform 0.25s ease" }}>
            <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
              <path d="M5.5 1v11M2 8.5l3.5 3.5L9 8.5M2 4.5L5.5 1 9 4.5"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <Panel label="Buy" amount={amountOut} usd={amountOut ? `≈ $${parseFloat(amountOut).toFixed(2)}` : "$0.00"}
          coin={coinOut} onCoinChange={setCoinOut} readOnly isLoading={quoteLoading && !!amountIn} />
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "fee",    value: feeAmt !== "—" ? `${feeAmt} ${coinIn}` : "—" },
          { label: "rate",   value: amountIn && amountOut ? `${(parseFloat(amountOut)/parseFloat(amountIn)).toFixed(4)}` : "—" },
          { label: "impact", value: priceImpact !== null ? `${priceImpact.toFixed(3)}%` : "—" },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center gap-1 rounded-md py-2.5"
            style={{ background: "var(--color-surface)" }}>
            <span className="text-[9px] font-mono text-tertiary uppercase tracking-widest">{label}</span>
            <span className="text-[10px] font-mono text-primary truncate px-1 text-center">{value}</span>
          </div>
        ))}
      </div>

      {/* Route */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-md" style={{ background: "var(--color-surface)" }}>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {[coinIn, "Orbital Pool", coinOut].map((node, i) => (
            <div key={i} className="flex items-center gap-1 min-w-0">
              {i > 0 && <span className="text-tertiary text-[10px] shrink-0">→</span>}
              <span className={`text-[10px] font-mono truncate ${i === 1 ? "text-tertiary" : "text-secondary"}`}>{node}</span>
            </div>
          ))}
        </div>
        <span className="text-[9px] font-mono text-tertiary shrink-0">best route</span>
      </div>

      {/* tx feedback */}
      {txHash && (
        <a
          href={`https://sepolia.basescan.org/tx/${txHash}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-mono text-green-400 hover:opacity-80 transition-all"
          style={{ background: "var(--color-surface)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
          tx confirmed · view on basescan ↗
        </a>
      )}
      {txError && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-[10px] font-mono text-red-400"
          style={{ background: "var(--color-surface)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
          {txError}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleAction}
        disabled={!!btnDisabled}
        className="w-full py-3 rounded-md bg-primary text-background text-xs font-mono tracking-widest uppercase hover:opacity-90 active:scale-[0.99] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {btnLabel()}
      </button>

      {/* Footer */}
      {amountIn && amountOut && (
        <p className="text-center text-[9px] font-mono text-tertiary">
          1 {coinIn} = {(parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)} {coinOut}
        </p>
      )}
    </div>
  );
}
