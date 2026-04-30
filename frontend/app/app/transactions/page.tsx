"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ExternalLink } from "lucide-react";
import { color, typography } from "@/constants";
import { usePool } from "@/lib/hooks/usePool";
import { useTransactions, type TxType } from "@/lib/hooks/useTransactions";
import { POOL_ADDRESS } from "@/lib/contracts";

const EXPLORER = "https://sepolia.basescan.org";

const TYPE_FILTERS = ["All", "Swap", "Add", "Remove", "Collect"] as const;
type Filter = typeof TYPE_FILTERS[number];

const TYPE_STYLE: Record<TxType, { color: string; bg: string }> = {
  Swap:    { color: "#60A5FA",       bg: "#60A5FA14" },
  Add:     { color: color.success,   bg: `${color.success}14` },
  Remove:  { color: color.warning,   bg: `${color.warning}14` },
  Collect: { color: color.textMuted, bg: color.surface3 },
};

function mono(size = "12px", col: string = color.textSecondary) {
  return { fontFamily: "var(--font-mono)" as const, fontSize: size, color: col as never };
}

function lbl() {
  return { ...mono("9px", color.textMuted), letterSpacing: "0.07em", textTransform: "uppercase" as const };
}

function shortAddr(a: string) { return a.slice(0, 12) + "…" + a.slice(-4); }

function timeAgo(unix: number): string {
  if (!unix) return "—";
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function TypeBadge({ type }: { type: TxType }) {
  const s = TYPE_STYLE[type];
  return (
    <span style={{
      ...mono("9px", s.color),
      backgroundColor: s.bg,
      border: `1px solid ${s.color}30`,
      padding: "3px 8px",
      letterSpacing: "0.06em",
      textTransform: "uppercase" as const,
      display: "inline-block",
      whiteSpace: "nowrap" as const,
    }}>
      {type}
    </span>
  );
}

// 12-column grid
const GRID = "repeat(12, 1fr)";

const COL_HEADERS = [
  { label: "Type",       col: "1 / 2",   align: "left"   },
  { label: "From",       col: "2 / 4",   align: "left"   },
  { label: "Pair",       col: "4 / 6",   align: "left"   },
  { label: "Amount In",  col: "6 / 7",   align: "left"   },
  { label: "Amount Out", col: "7 / 8",   align: "center" },
  { label: "Time",       col: "8 / 10",  align: "center" },
  { label: "Block",      col: "10 / 11", align: "left"   },
  { label: "Tx Hash",    col: "11 / 13", align: "right"  },
];

function ColHeaders() {
  return (
    <div className="grid items-center px-5 py-2.5 shrink-0"
      style={{ gridTemplateColumns: GRID, borderBottom: `1px solid ${color.borderSubtle}`, backgroundColor: color.surface2 }}>
      {COL_HEADERS.map(({ label, col, align }) => (
        <span key={label} style={{ ...lbl(), gridColumn: col, textAlign: align as "left" | "center" }}>{label}</span>
      ))}
    </div>
  );
}

export default function TransactionsPage() {
  const [filter, setFilter] = useState<Filter>("All");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { pool }   = usePool(POOL_ADDRESS);
  const poolTokens = pool?.tokens ?? [];
  const { txs, isLoading, isLoadingMore, hasMore, loadMore, error } = useTransactions(poolTokens);

  const visible = filter === "All" ? txs : txs.filter(t => t.type === filter);

  const counts: Record<Filter, number> = {
    All:     txs.length,
    Swap:    txs.filter(t => t.type === "Swap").length,
    Add:     txs.filter(t => t.type === "Add").length,
    Remove:  txs.filter(t => t.type === "Remove").length,
    Collect: txs.filter(t => t.type === "Collect").length,
  };

  // Infinite scroll via IntersectionObserver
  const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(handleIntersect, { root: scrollRef.current, threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [handleIntersect]);

  return (
    <div className="flex flex-col overflow-hidden w-full" style={{ height: "calc(100vh - 5.5rem)" }}>
      <div className="flex-1 min-h-0 flex flex-col" style={{ border: `1px solid ${color.border}` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
          <div>
            <h1 style={{ fontFamily: typography.h2.family, fontSize: typography.h2.size, fontWeight: 500, letterSpacing: typography.h2.letterSpacing, color: color.textPrimary }}>
              Transactions
            </h1>
            <p style={{ fontFamily: typography.p2.family, fontSize: typography.p2.size, color: color.textMuted, marginTop: 4 }}>
              {isLoading ? "Loading…" : `${txs.length} loaded · all on-chain activity`}
            </p>
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {TYPE_FILTERS.map(f => {
              const active = filter === f;
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className="flex items-center gap-1.5 px-3 py-1.5"
                  style={{ border: `1px solid ${active ? color.textPrimary : color.border}`, backgroundColor: active ? color.surface2 : "transparent", cursor: "pointer", ...mono("10px", active ? color.textPrimary : color.textMuted) }}>
                  {f}
                  <span style={{ ...mono("9px", active ? color.textPrimary : color.textMuted), backgroundColor: active ? color.surface3 : color.surface2, padding: "0 5px" }}>
                    {counts[f]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Column headers */}
        <ColHeaders />

        {/* Scrollable body */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">

          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <span style={mono("12px", color.textMuted)}>Loading latest transactions…</span>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex items-center justify-center py-16">
              <span style={mono("12px", color.warning)}>{error}</span>
            </div>
          )}

          {!isLoading && !error && visible.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <span style={mono("12px", color.textMuted)}>No transactions found</span>
            </div>
          )}

          {!isLoading && visible.map((tx, i) => (
            <div key={tx.hash + i}
              className="grid items-center px-5 py-3"
              style={{ gridTemplateColumns: GRID, borderBottom: `1px solid ${color.borderSubtle}` }}>

              {/* Type — col 1 */}
              <div style={{ gridColumn: "1 / 2", minWidth: 0 }}>
                <TypeBadge type={tx.type} />
              </div>

              {/* From — col 2-3 */}
              <span style={{ gridColumn: "2 / 4", ...mono("11px", color.textSecondary), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                {shortAddr(tx.actor)}
              </span>

              {/* Pair (token in → token out) — col 4-5 */}
              <div style={{ gridColumn: "4 / 6", display: "flex", alignItems: "center", gap: 4, overflow: "hidden" }}>
                {tx.amountOut ? (
                  <>
                    <span style={{ ...mono("11px", color.textSecondary), whiteSpace: "nowrap" as const }}>{tx.amountIn.split(" ")[1] ?? "—"}</span>
                    <span style={{ ...mono("10px", color.textMuted) }}>→</span>
                    <span style={{ ...mono("11px", color.textSecondary), whiteSpace: "nowrap" as const }}>{tx.amountOut.split(" ")[1] ?? "—"}</span>
                  </>
                ) : (
                  <span style={{ ...mono("11px", color.textMuted) }}>—</span>
                )}
              </div>

              {/* Amount In — col 6 */}
              <span style={{ gridColumn: "6 / 7", ...mono("12px", color.textPrimary), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, paddingRight: 8 }}>
                {tx.amountIn.split(" ")[0] ?? tx.amountIn}
              </span>

              {/* Amount Out — col 7, centered */}
              <span style={{ gridColumn: "7 / 8", ...mono("12px", tx.amountOut ? color.success : color.textMuted), textAlign: "center" as const, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                {tx.amountOut ? tx.amountOut.split(" ")[0] : "—"}
              </span>

              {/* Time — col 8-9, centered */}
              <span style={{ gridColumn: "8 / 10", ...mono("11px", color.textMuted), textAlign: "center" as const }}
                title={tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : ""}>
                {timeAgo(tx.timestamp)}
              </span>

              {/* Block — col 10 */}
              <a href={`${EXPLORER}/block/${tx.blockNumber}`} target="_blank" rel="noreferrer"
                style={{ gridColumn: "10 / 11", ...mono("11px", color.textMuted), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}
                className="hover:opacity-70 transition-opacity">
                #{tx.blockNumber.toString()}
              </a>

              {/* Tx Hash — col 11-12, right */}
              <a href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                style={{ gridColumn: "11 / 13", ...mono("11px", color.textMuted), justifyContent: "flex-end" }}>
                {tx.hash.slice(0, 24)}…{tx.hash.slice(-4)}
                <ExternalLink size={9} color={color.textMuted} />
              </a>
            </div>
          ))}

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="py-3 flex items-center justify-center">
            {isLoadingMore && <span style={mono("11px", color.textMuted)}>Loading more…</span>}
            {!isLoading && !isLoadingMore && !hasMore && txs.length > 0 && (
              <span style={mono("10px", color.textMuted)}>All transactions loaded</span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
