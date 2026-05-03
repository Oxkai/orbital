"use client";

import { useState, useCallback, use } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { TokenDAI, TokenUSDT, TokenUSDC, TokenFRAX } from "@token-icons/react";
import { color, typography } from "@/constants";
import { TokenPill } from "@/components/app/shared/TokenPill";

const TOKEN_ICON_MAP: Record<string, React.ElementType> = {
  DAI: TokenDAI, USDT: TokenUSDT, USDC: TokenUSDC, FRAX: TokenFRAX,
};
const TOKEN_COLOR_MAP: Record<string, string> = {
  CRVUSD: "#FF6B35",
};
function TokenIcon({ symbol, size = 16 }: { symbol: string; size?: number }) {
  const Icon = TOKEN_ICON_MAP[symbol.toUpperCase()];
  if (Icon) return <Icon size={size} variant="branded" />;
  const bg = TOKEN_COLOR_MAP[symbol.toUpperCase()] ?? "#555";
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", backgroundColor: bg, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: Math.max(6, size * 0.38), color: "#fff", fontFamily: "var(--font-mono)", fontWeight: 700, letterSpacing: "-0.02em" }}>
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  );
}
import { Badge }     from "@/components/app/shared/Badge";
import { StatBox }   from "@/components/app/shared/StatBox";
import { usePool }   from "@/lib/hooks/usePool";
import { useTransactions, type TxType } from "@/lib/hooks/useTransactions";
import { DepthChart } from "@/components/app/pool/DepthChart";
import { fmtUSD }   from "@/lib/mock/data";
import { type Address } from "viem";

const TABS = ["Overview", "Liquidity", "Transactions"] as const;
type Tab = typeof TABS[number];

function mono(size = "12px", col: string = color.textSecondary) {
  return { fontFamily: "var(--font-mono)" as const, fontSize: size, color: col as never };
}

function lbl() {
  return { ...mono("9px", color.textMuted), letterSpacing: "0.07em", textTransform: "uppercase" as const };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);
  return (
    <button
      onClick={handleCopy}
      style={{
        ...mono("10px", copied ? color.success : color.textMuted),
        background: "none",
        border: `1px solid ${color.borderSubtle}`,
        padding: "1px 7px",
        cursor: "pointer",
        letterSpacing: "0.04em",
        transition: "color 0.15s",
      }}
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

function OverviewTab({ pool }: { pool: NonNullable<ReturnType<typeof usePool>["pool"]> }) {
  const totalReserves = pool.reserves.reduce((a, b) => a + b, 0);
  const boundaryCount = pool.ticks.filter(t => !t.isInterior).length;

  return (
    <div className="flex flex-col">

      {/* Stats row — borderBottom only; StatBox has no own border */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", borderBottom: `1px solid ${color.border}`, backgroundColor: color.surface1 }}>
        {([
          { label: "TVL",      value: fmtUSD(pool.tvl) },
          { label: "Vol 24H",  value: pool.volume24h > 0 ? fmtUSD(pool.volume24h) : "—" },
          { label: "Fees 24H", value: pool.fees24h > 0 ? fmtUSD(pool.fees24h) : "—" },
          { label: "Fee Tier", value: `${(pool.fee / 10000).toFixed(2)}%` },
        ] as { label: string; value: string }[]).map((s, i, arr) => (
          <div key={s.label} style={{ borderRight: i < arr.length - 1 ? `1px solid ${color.border}` : undefined }}>
            <StatBox label={s.label} value={s.value} />
          </div>
        ))}
      </div>

      {/* Reserve distribution + Depth chart — borderBottom only; left panel has borderRight */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "stretch", minHeight: 360, borderBottom: `1px solid ${color.border}` }}>

        {/* Reserve distribution */}
        <div style={{ borderRight: `1px solid ${color.border}`, backgroundColor: color.surface1 }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
            <span style={lbl()}>Reserve Distribution</span>
            <span style={mono("10px", color.textMuted)}>TVL {fmtUSD(pool.tvl, true)}</span>
          </div>

          <div className="px-4 pt-3 pb-1">
            <div className="flex h-1.5 gap-px overflow-hidden">
              {pool.tokens.map((t, i) => (
                <div
                  key={t.address}
                  style={{
                    width: `${totalReserves > 0 ? (pool.reserves[i] / totalReserves) * 100 : 0}%`,
                    backgroundColor: t.color,
                    opacity: pool.ticks[i]?.isInterior === false ? 0.35 : 1,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col">
            {pool.tokens.map((t, i) => {
              const pct = totalReserves > 0 ? (pool.reserves[i] / totalReserves) * 100 : 0;
              const isDepegged = pool.ticks[i]?.isInterior === false;
              return (
                <div key={t.address} className="grid items-center px-4 py-2.5"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr auto", borderBottom: `1px solid ${color.borderSubtle}` }}>
                  <div className="flex items-center gap-2">
                    <TokenIcon symbol={t.symbol} size={16} />
                    <span style={mono("12px", color.textSecondary)}>{t.symbol}</span>
                  </div>
                  <span style={mono("12px", color.textPrimary)}>{fmtUSD(pool.reserves[i], true)}</span>
                  <span style={mono("11px", color.textMuted)}>{pct.toFixed(1)}%</span>
                  {isDepegged && <Badge variant="warning" dot>depegged</Badge>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Depth chart — fills right cell, no extra border */}
        <DepthChart
          ticks={pool.ticks}
          n={pool.tokens.length}
          rInt={pool.rInt}
          kBound={pool.kBound}
          sumX={pool.sumX}
        />

      </div>

      {/* Pool info — no outer border, just top separator already provided by row above */}
      <div style={{ backgroundColor: color.surface1 }}>
        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
          <span style={lbl()}>Pool Info</span>
        </div>
        <div className="flex flex-col">
          {([
            { label: "Contract",     value: pool.address,                                                  copy: true  },
            { label: "Fee Tier",     value: `${(pool.fee / 10000).toFixed(2)}%`,                           copy: false },
            { label: "Assets",       value: `${pool.tokens.length} tokens`,                                copy: false },
            { label: "Active Ticks", value: `${pool.ticks.length - boundaryCount} / ${pool.ticks.length}`, copy: false },
            { label: "TVL",          value: fmtUSD(pool.tvl),                                              copy: false },
          ] as { label: string; value: string; copy: boolean }[]).map((r, idx, arr) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: idx < arr.length - 1 ? `1px solid ${color.borderSubtle}` : undefined }}>
              <span style={lbl()}>{r.label}</span>
              <div className="flex items-center gap-2">
                <span style={{ ...mono("11px", color.textSecondary), maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                  {r.value}
                </span>
                {r.copy && <CopyButton text={r.value} />}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function LiquidityTab({ pool }: { pool: NonNullable<ReturnType<typeof usePool>["pool"]> }) {
  const maxR = Math.max(...pool.ticks.map(t => t.r), 1);

  return (
    <div style={{ backgroundColor: color.surface1 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
        <span style={lbl()}>Tick Map</span>
        <span style={mono("10px", color.textMuted)}>
          {pool.ticks.length} ticks · {pool.ticks.filter(t => t.isInterior).length} active
        </span>
      </div>

      {/* Column headers */}
      <div className="grid items-center px-4 py-2.5"
        style={{ gridTemplateColumns: "48px 1fr 120px 80px", borderBottom: `1px solid ${color.borderSubtle}`, backgroundColor: color.surface2 }}>
        {["#", "Liquidity (r)", "k (WAD)", "Status"].map(h => (
          <span key={h} style={lbl()}>{h}</span>
        ))}
      </div>

      {pool.ticks.map((tick, i) => (
        <div key={i} className="grid items-center px-4"
          style={{
            gridTemplateColumns: "48px 1fr 120px 80px",
            borderBottom: i < pool.ticks.length - 1 ? `1px solid ${color.borderSubtle}` : undefined,
            backgroundColor: !tick.isInterior ? `${color.warning}06` : "transparent",
            minHeight: 48,
          }}>
          <span style={mono("11px", color.textMuted)}>{i}</span>

          <div className="flex flex-col gap-1 py-2 pr-4">
            <span style={mono("12px", color.textPrimary)}>{fmtUSD(tick.r)}</span>
            <div style={{ height: 2, backgroundColor: color.surface3, overflow: "hidden" }}>
              <div style={{
                width: `${maxR > 0 ? (tick.r / maxR) * 100 : 0}%`,
                height: "100%",
                backgroundColor: tick.isInterior ? color.success : color.warning,
                opacity: 0.5,
              }} />
            </div>
          </div>

          <span style={mono("11px", color.textMuted)}>{(Number(tick.kWad) / 1e18).toFixed(4)}</span>

          <Badge variant={tick.isInterior ? "success" : "warning"} dot>
            {tick.isInterior ? "Active" : "Paused"}
          </Badge>
        </div>
      ))}

      {pool.ticks.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <span style={mono("11px", color.textMuted)}>No ticks found</span>
        </div>
      )}
    </div>
  );
}

// ─── Transactions tab ─────────────────────────────────────────────────────────

const EXPLORER = "https://sepolia.basescan.org";

const TYPE_COLOR: Record<TxType, string> = {
  Swap:    "#60A5FA",
  Add:     color.success,
  Remove:  color.warning,
  Collect: color.textMuted,
};

function timeAgo(unix: number): string {
  if (!unix) return "—";
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function TransactionsTab({ pool }: { pool: NonNullable<ReturnType<typeof usePool>["pool"]> }) {
  const { txs, isLoading, isLoadingMore, hasMore, loadMore, error } = useTransactions(pool.tokens);

  return (
    <div style={{ backgroundColor: color.surface1 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
        <span style={lbl()}>Transaction History</span>
        <span style={mono("10px", color.textMuted)}>
          {isLoading ? "Loading…" : `${txs.length} loaded`}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid items-center px-4 py-2"
        style={{ gridTemplateColumns: "72px 1fr 1fr 1fr 80px 100px", borderBottom: `1px solid ${color.borderSubtle}`, backgroundColor: color.surface2 }}>
        {["Type", "From", "Amount In", "Amount Out", "Time", "Tx Hash"].map(h => (
          <span key={h} style={lbl()}>{h}</span>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <span style={mono("11px", color.textMuted)}>Scanning on-chain events…</span>
        </div>
      )}

      {error && !isLoading && (
        <div className="flex items-center justify-center py-12">
          <span style={mono("11px", color.warning)}>{error}</span>
        </div>
      )}

      {!isLoading && !error && txs.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <span style={mono("11px", color.textMuted)}>No transactions found</span>
        </div>
      )}

      {txs.map((tx, i) => (
        <div key={tx.hash + i} className="grid items-center px-4 py-2.5"
          style={{ gridTemplateColumns: "72px 1fr 1fr 1fr 80px 100px", borderBottom: `1px solid ${color.borderSubtle}` }}>

          <span style={{ ...mono("9px", TYPE_COLOR[tx.type]), backgroundColor: `${TYPE_COLOR[tx.type]}14`, padding: "2px 7px", letterSpacing: "0.06em", textTransform: "uppercase" as const, display: "inline-block", whiteSpace: "nowrap" as const }}>
            {tx.type}
          </span>

          <span style={{ ...mono("11px", color.textSecondary), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {tx.actor.slice(0, 8)}…{tx.actor.slice(-4)}
          </span>

          <span style={{ ...mono("11px", color.textPrimary), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {tx.amountIn}
          </span>

          <span style={{ ...mono("11px", tx.amountOut ? color.success : color.textMuted), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {tx.amountOut || "—"}
          </span>

          <span style={mono("10px", color.textMuted)} title={tx.timestamp ? new Date(tx.timestamp * 1000).toLocaleString() : ""}
            suppressHydrationWarning>
            {timeAgo(tx.timestamp)}
          </span>

          <a href={`${EXPLORER}/tx/${tx.hash}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 hover:opacity-70 transition-opacity"
            style={mono("10px", color.textMuted)}>
            {tx.hash.slice(0, 10)}…
            <ExternalLink size={9} color={color.textMuted} />
          </a>
        </div>
      ))}

      {!isLoading && (hasMore || isLoadingMore) && (
        <div className="flex items-center justify-center py-4">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            style={{ ...mono("10px", isLoadingMore ? color.textMuted : color.textPrimary), border: `1px solid ${color.border}`, backgroundColor: "transparent", padding: "6px 16px", cursor: isLoadingMore ? "not-allowed" : "pointer" }}
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {!isLoading && !hasMore && txs.length > 0 && (
        <div className="flex items-center justify-center py-3">
          <span style={mono("10px", color.textMuted)}>All transactions loaded</span>
        </div>
      )}
    </div>
  );
}

export default function PoolDetailPage({ params }: { params: Promise<{ address: string }> }) {
  const { address: poolAddr } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const { pool, isLoading } = usePool(poolAddr as Address);

  return (
    <div className="flex flex-col overflow-hidden w-full" style={{ height: "calc(100vh - 5.5rem)" }}>
      {/* Single outer border wraps everything */}
      <div className="flex-1 min-h-0 grid grid-cols-[80px_1fr_80px]" style={{ border: `1px solid ${color.border}` }}>

        {/* Left gutter */}
        <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderRight: `1px solid ${color.border}` }} />

        {/* Main column */}
        <div className="flex-1 min-h-0 flex flex-col">

          {/* Page header */}
          <div className="flex items-center justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: `1px solid ${color.border}` }}>
            <div>
              <h1 style={{ fontFamily: typography.h2.family, fontSize: typography.h2.size, fontWeight: 500, letterSpacing: typography.h2.letterSpacing, color: color.textPrimary }}>
                {pool ? pool.tokens.map(t => t.symbol).join(" / ") : "Pool"}
              </h1>
              <p style={{ fontFamily: typography.p2.family, fontSize: typography.p2.size, color: color.textMuted, marginTop: 4 }}>
                {isLoading
                  ? "Loading…"
                  : pool
                  ? `${fmtUSD(pool.tvl)} TVL · ${(pool.fee / 10000).toFixed(2)}% fee · ${pool.ticks.length} ticks`
                  : "Pool not found"}
              </p>
            </div>

            {pool && (
              <div className="flex items-center gap-2 shrink-0">
                <Link href="/app/swap" className="px-4 py-2"
                  style={{ backgroundColor: color.textPrimary, color: color.bg, fontFamily: typography.p2.family, fontSize: typography.p2.size, fontWeight: 500, letterSpacing: "-0.01em" }}>
                  Swap
                </Link>
                <Link href={`/app/pool/${pool.address}/add`} className="px-4 py-2"
                  style={{ border: `1px solid ${color.border}`, color: color.textPrimary, fontFamily: typography.p2.family, fontSize: typography.p2.size, letterSpacing: "-0.01em" }}>
                  + Add Liquidity
                </Link>
              </div>
            )}
          </div>

          {/* Token pills + tab bar */}
          {pool && (
            <div className="flex items-center justify-between px-5 shrink-0"
              style={{ borderBottom: `1px solid ${color.border}` }}>
              <div className="flex items-center py-3" style={{ gap: 0 }}>
                {pool.tokens.map((t, i) => (
                  <span key={t.address} className="flex items-center">
                    {i > 0 && (
                      <span style={{ color: color.textMuted, fontSize: "11px", margin: "0 8px", opacity: 0.3 }}>/</span>
                    )}
                    <TokenPill token={t} size="sm" />
                  </span>
                ))}
              </div>

              <div className="flex">
                {TABS.map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className="px-4 py-3"
                    style={{
                      fontFamily: typography.p2.family,
                      fontSize: typography.p2.size,
                      letterSpacing: "-0.01em",
                      color: activeTab === tab ? color.textPrimary : color.textMuted,
                      borderBottom: activeTab === tab ? `2px solid ${color.textPrimary}` : "2px solid transparent",
                      cursor: "pointer",
                      background: "none",
                    }}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading && (
              <div className="px-5 py-4" style={mono("12px", color.textMuted)}>Loading pool data…</div>
            )}
            {!isLoading && !pool && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span style={mono("13px", color.textMuted)}>Pool not found</span>
                <span style={mono("11px", color.textMuted)}>{poolAddr}</span>
              </div>
            )}
            {pool && activeTab === "Overview"      && <OverviewTab      pool={pool} />}
            {pool && activeTab === "Liquidity"     && <LiquidityTab     pool={pool} />}
            {pool && activeTab === "Transactions"  && <TransactionsTab  pool={pool} />}
          </div>

        </div>

        {/* Right gutter */}
        <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderLeft: `1px solid ${color.border}` }} />

      </div>
    </div>
  );
}
