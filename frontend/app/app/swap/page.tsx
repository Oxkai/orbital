"use client";

import { color, typography } from "@/constants";
import { SwapWidget } from "@/components/app/swap/SwapWidget";
import { PriceChart }  from "@/components/app/swap/PriceChart";
import { usePool } from "@/lib/hooks/usePool";
import { fmtUSD } from "@/lib/mock/data";
import { POOL_ADDRESS } from "@/lib/contracts";
function SwapPageInner() {
  return (
    <div className="flex-1 min-h-0 grid grid-cols-3" style={{ border: `1px solid ${color.border}` }}>
      <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderRight: `1px solid ${color.border}` }} />
      <div className="flex m-3 flex-col">
        <SwapWidget />
      </div>
      <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderLeft: `1px solid ${color.border}` }} />
    </div>
  );
}

function PoolReserves() {
  const { pool } = usePool(POOL_ADDRESS);
  if (!pool) {
    return (
      <div className="px-4 py-4" style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: color.textMuted }}>
        Loading pool data…
      </div>
    );
  }

  const total  = pool.reserves.reduce((a, b) => a + b, 0);
  const fee    = pool.fee;

  return (
    <div style={{ backgroundColor: color.surface1 }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase" as const, color: color.textMuted }}>
          Pool Reserves
        </span>
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: color.textMuted }}>
            TVL {fmtUSD(pool.tvl)}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: color.accent }}>
            {(fee / 10000).toFixed(2)}% fee
          </span>
        </div>
      </div>

      <div className="px-4 pt-3 pb-1">
        <div className="flex h-1.5 gap-px overflow-hidden">
          {pool.tokens.map((t, i) => (
            <div key={t.address} style={{ width: `${total > 0 ? (pool.reserves[i] / total) * 100 : 25}%`, backgroundColor: t.color, opacity: pool.ticks[i]?.isInterior === false ? 0.35 : 1 }} />
          ))}
        </div>
      </div>

      <div className="flex flex-col">
        {pool.tokens.map((t, i) => {
          const pct = total > 0 ? (pool.reserves[i] / total) * 100 : 25;
          return (
            <div key={t.address} className="grid items-center px-4 py-2.5"
              style={{ gridTemplateColumns: "1fr 1fr 1fr", borderBottom: `1px solid ${color.borderSubtle}` }}>
              <div className="flex items-center gap-2">
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: t.color, display: "inline-block" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: color.textSecondary }}>{t.symbol}</span>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: color.textPrimary }}>
                {fmtUSD(pool.reserves[i])}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: color.textMuted }}>
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 px-4 py-3" style={{ borderTop: `1px solid ${color.borderSubtle}` }}>
        {[
          { label: "TVL",      value: fmtUSD(pool.tvl)  },
          { label: "Ticks",    value: String(pool.ticks.length) },
          { label: "Fee tier", value: `${(fee / 10000).toFixed(2)}%` },
        ].map(s => (
          <div key={s.label}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", letterSpacing: "0.07em", textTransform: "uppercase" as const, color: color.textMuted, marginBottom: 3 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: typography.h3.family, fontSize: "14px", fontWeight: 500, letterSpacing: "-0.02em", color: color.textPrimary }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SwapPage() {
  return (
    <div className="flex flex-col overflow-hidden w-full" style={{ height: "calc(100vh - 5.5rem)" }}>
      <div className="flex-1 flex flex-col">
        <SwapPageInner />
      </div>
    </div>
  );
}
