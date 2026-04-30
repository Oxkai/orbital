import Link from "next/link";
import { color, typography, typeStyle } from "@/constants";
import { TokenPill } from "@/components/app/shared/TokenPill";
import { Badge }     from "@/components/app/shared/Badge";
import { StatBox }   from "@/components/app/shared/StatBox";
import { fmtUSD, type Pool } from "@/lib/mock/data";

interface PoolCardProps {
  pool: Pool;
}

export function PoolCard({ pool }: PoolCardProps) {
  const boundaryCount = pool.ticks.filter(t => !t.isInterior).length;
  const healthVariant = boundaryCount === 0 ? "success" : boundaryCount <= 1 ? "warning" : "error";
  const healthLabel   = boundaryCount === 0 ? "All pegged" : `${boundaryCount} depegged`;

  return (
    <div
      style={{
        borderBottom: `1px solid ${color.border}`,
        backgroundColor: color.surface1,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${color.borderSubtle}` }}
      >
        {/* Token pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {pool.tokens.map(t => (
            <TokenPill key={t.address} token={t} size="sm" />
          ))}
        </div>

        {/* Health + fee tier */}
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={healthVariant} dot>
            {healthLabel}
          </Badge>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.06em",
              color: color.textMuted,
              border: `1px solid ${color.borderSubtle}`,
              padding: "2px 6px",
            }}
          >
            {(pool.fee / 10000).toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4">
        <StatBox label="TVL"      value={fmtUSD(pool.tvl)} />
        <StatBox label="Vol 24H"  value={fmtUSD(pool.volume24h)} />
        <StatBox label="Fees 24H" value={fmtUSD(pool.fees24h)} />
        <StatBox label="Fee tier" value={(pool.fee / 10000).toFixed(2) + "%"} />
      </div>

      {/* Liquidity bar */}
      <div
        className="px-4 py-3"
        style={{ borderTop: `1px solid ${color.borderSubtle}` }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: color.textMuted,
            marginBottom: 8,
          }}
        >
          Reserve distribution
        </div>
        <div className="flex h-1.5 gap-px overflow-hidden">
          {pool.tokens.map((t, i) => {
            const total = pool.reserves.reduce((a, b) => a + b, 0);
            const pct   = (pool.reserves[i] / total) * 100;
            return (
              <div
                key={t.address}
                style={{
                  width: `${pct}%`,
                  backgroundColor: t.color,
                  opacity: pool.ticks[i]?.isInterior === false ? 0.35 : 1,
                }}
              />
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 flex-wrap">
          {pool.tokens.map((t, i) => {
            const total = pool.reserves.reduce((a, b) => a + b, 0);
            const pct   = ((pool.reserves[i] / total) * 100).toFixed(1);
            return (
              <span
                key={t.address}
                className="flex items-center gap-1"
                style={{ ...typeStyle("caption"), color: color.textMuted }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    backgroundColor: t.color,
                    display: "inline-block",
                  }}
                />
                {t.symbol} {pct}%
              </span>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex gap-2 px-4 py-3"
        style={{ borderTop: `1px solid ${color.borderSubtle}` }}
      >
        <Link
          href="/app/swap"
          className="px-4 py-2"
          style={{
            backgroundColor: color.textPrimary,
            color: color.bg,
            fontFamily: typography.p2.family,
            fontSize: typography.p2.size,
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          Swap
        </Link>
        <Link
          href={`/app/pool/${pool.address}/add`}
          className="px-4 py-2"
          style={{
            border: `1px solid ${color.border}`,
            backgroundColor: "transparent",
            color: color.textPrimary,
            fontFamily: typography.p2.family,
            fontSize: typography.p2.size,
            letterSpacing: "-0.01em",
          }}
        >
          Add Liquidity
        </Link>
        <Link
          href={`/app/pool/${pool.address}`}
          className="px-4 py-2 ml-auto"
          style={{
            color: color.textMuted,
            fontFamily: typography.p2.family,
            fontSize: typography.p2.size,
            letterSpacing: "-0.01em",
          }}
        >
          Details →
        </Link>
      </div>
    </div>
  );
}
