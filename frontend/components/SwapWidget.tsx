"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuote, useAllowance, useApprove, useExactInput, type SwapCoin } from "@/lib/useSwap";

const COINS: SwapCoin[] = ["USDC", "DAI", "FRAX", "USDT"];
const TABS = ["Swap", "Send", "Buy"] as const;
type Tab = (typeof TABS)[number];

const COIN_COLORS: Record<SwapCoin, string> = {
  USDC: "#2775CA",
  DAI:  "#F5AC37",
  FRAX: "#1A1A1A",
  USDT: "#26A17B",
};

function CoinBadge({ coin }: { coin: SwapCoin }) {
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold shrink-0"
      style={{ background: COIN_COLORS[coin], color: "#fff" }}
    >
      {coin[0]}
    </span>
  );
}

function CoinSelector({ coin, onSelect }: { coin: SwapCoin; onSelect: (c: SwapCoin) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg text-[12px] font-mono font-medium transition-all duration-150 hover:opacity-80"
        style={{
          background: "var(--color-surface-alt)",
          border: "1px solid var(--color-border)",
          color: "var(--color-primary)",
        }}
      >
        <CoinBadge coin={coin} />
        {coin}
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" style={{ color: "var(--color-tertiary)" }}>
          <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-1.5 w-32 z-20 rounded-xl overflow-hidden py-1"
            style={{
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-border)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            }}
          >
            {COINS.map((c) => (
              <button
                key={c}
                onClick={() => { onSelect(c); setOpen(false); }}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 transition-colors"
                style={{
                  background: c === coin ? "var(--color-surface-alt)" : "transparent",
                  color: c === coin ? "var(--color-primary)" : "var(--color-secondary)",
                }}
              >
                <CoinBadge coin={c} />
                <span className="text-[12px] font-mono">{c}</span>
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
    <div
      className="p-4 flex flex-col gap-3"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-mono tracking-widest uppercase"
          style={{ color: "var(--color-tertiary)" }}
        >
          {label}
        </span>
        {balance && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono" style={{ color: "var(--color-tertiary)" }}>
              {parseFloat(balance).toFixed(4)}{" "}
              <span style={{ color: "var(--color-secondary)" }}>{coin}</span>
            </span>
            {showMax && (
              <button
                onClick={() => onAmountChange?.(balance)}
                className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest transition-all hover:opacity-80"
                style={{
                  background: "var(--color-quaternary)",
                  color: "var(--color-primary)",
                }}
              >
                max
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {readOnly ? (
          <span
            className={`text-[28px] font-mono font-medium leading-none transition-opacity ${isLoading ? "opacity-30" : ""}`}
            style={{ color: "var(--color-primary)" }}
          >
            {isLoading ? "…" : (amount || "0")}
          </span>
        ) : (
          <input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange?.(e.target.value)}
            placeholder="0"
            className="text-[28px] font-mono font-medium leading-none bg-transparent outline-none w-full placeholder:opacity-20"
            style={{ color: "var(--color-primary)" }}
          />
        )}
        <CoinSelector coin={coin} onSelect={onCoinChange} />
      </div>

      <span className="text-[10px] font-mono" style={{ color: "var(--color-tertiary)" }}>
        {usd}
      </span>
    </div>
  );
}

export default function SwapWidget() {
  const { isConnected } = useAccount();
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
    if (!isConnected)   return "Connect Wallet";
    if (approving)      return "Approving…";
    if (swapping)       return "Swapping…";
    if (needsApproval)  return `Approve ${coinIn}`;
    if (!amountIn || parseFloat(amountIn) === 0) return "Enter Amount";
    return "Swap";
  };

  const btnDisabled = isConnected && !needsApproval && (!amountIn || parseFloat(amountIn) === 0 || swapping || approving);
  const isAction = isConnected && (needsApproval || (amountIn && parseFloat(amountIn) > 0));

  return (
    <div className="w-full flex flex-col gap-3 select-none">

      {/* Panels */}
      <div
        className="flex flex-col rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--color-border)" }}
      >
        <Panel
          label="Sell"
          amount={amountIn}
          usd={amountIn ? `≈ $${parseFloat(amountIn).toFixed(2)}` : "$0.00"}
          coin={coinIn}
          balance={balance}
          showMax
          onAmountChange={setAmountIn}
          onCoinChange={setCoinIn}
        />

        {/* Divider + flip button */}
        <div
          className="relative flex items-center justify-center h-0"
          style={{ borderTop: "1px solid var(--color-border)", zIndex: 10 }}
        >
          <button
            onClick={handleFlip}
            className="absolute w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "var(--color-surface-alt)",
              border: "1px solid var(--color-border)",
              color: "var(--color-secondary)",
              transform: `rotate(${flipped ? 180 : 0}deg)`,
              transition: "transform 0.25s ease",
            }}
          >
            <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
              <path d="M6 1v12M2.5 9.5L6 13l3.5-3.5M2.5 4.5L6 1l3.5 3.5"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <Panel
          label="Buy"
          amount={amountOut}
          usd={amountOut ? `≈ $${parseFloat(amountOut).toFixed(2)}` : "$0.00"}
          coin={coinOut}
          onCoinChange={setCoinOut}
          readOnly
          isLoading={quoteLoading && !!amountIn}
        />
      </div>

      {/* Info grid */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--color-border)" }}
      >
        {[
          { label: "Fee",          value: feeAmt !== "—" ? `${feeAmt} ${coinIn}` : "—" },
          { label: "Exchange Rate", value: amountIn && amountOut ? `1 ${coinIn} = ${(parseFloat(amountOut)/parseFloat(amountIn)).toFixed(4)} ${coinOut}` : "—" },
          { label: "Price Impact",  value: priceImpact !== null ? `${priceImpact.toFixed(3)}%` : "—",
            warn: priceImpact !== null && priceImpact > 1 },
        ].map(({ label, value, warn }, i, arr) => (
          <div
            key={label}
            className="flex items-center justify-between px-4 py-2.5"
            style={{
              background: "var(--color-surface)",
              borderBottom: i < arr.length - 1 ? "1px solid var(--color-border)" : "none",
            }}
          >
            <span className="text-[10px] font-mono" style={{ color: "var(--color-tertiary)" }}>
              {label}
            </span>
            <span
              className="text-[11px] font-mono font-medium"
              style={{ color: warn ? "#f87171" : "var(--color-secondary)" }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Route */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {[coinIn, "Orbital Pool", coinOut].map((node, i) => (
            <div key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none" style={{ color: "var(--color-tertiary)", flexShrink: 0 }}>
                  <path d="M1 4h8M6 1l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {i !== 1 && <CoinBadge coin={node as SwapCoin} />}
              <span
                className="text-[10px] font-mono truncate"
                style={{ color: i === 1 ? "var(--color-tertiary)" : "var(--color-secondary)" }}
              >
                {node}
              </span>
            </div>
          ))}
        </div>
        <span
          className="text-[9px] font-mono shrink-0 px-1.5 py-0.5 rounded"
          style={{ background: "var(--color-quaternary)", color: "var(--color-primary)" }}
        >
          best
        </span>
      </div>

      {/* TX feedback */}
      {txHash && (
        <a
          href={`https://sepolia.basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-[11px] font-mono transition-all hover:opacity-80"
          style={{
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.2)",
            color: "#4ade80",
          }}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#4ade80" }} />
          <span className="flex-1">Transaction confirmed</span>
          <span className="opacity-60">↗ basescan</span>
        </a>
      )}
      {txError && (
        <div
          className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-[11px] font-mono"
          style={{
            background: "rgba(248,113,113,0.06)",
            border: "1px solid rgba(248,113,113,0.2)",
            color: "#f87171",
          }}
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: "#f87171" }} />
          {txError}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleAction}
        disabled={!!btnDisabled}
        className="w-full py-3.5 rounded-xl text-[12px] font-mono font-semibold tracking-widest uppercase transition-all duration-150 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: isAction ? "var(--color-primary)" : "var(--color-primary)",
          color: isAction ? "#fff" : "var(--color-background)",
          boxShadow: isAction && !btnDisabled ? "0 0 0 1px var(--color-primary)" : "none",
        }}
      >
        {btnLabel()}
      </button>

      {/* Rate footer */}
      {amountIn && amountOut && (
        <p className="text-center text-[10px] font-mono" style={{ color: "var(--color-tertiary)" }}>
          1 {coinIn} ={" "}
          <span style={{ color: "var(--color-tertiary)" }}>
            {(parseFloat(amountOut) / parseFloat(amountIn)).toFixed(6)} {coinOut}
          </span>
        </p>
      )}
    </div>
  );
}
