"use client";

import { color, typography } from "@/constants";
import { useAccount } from "wagmi";
import { usePool } from "@/lib/hooks/usePool";
import { usePositions, useTickStatus, fmtWad } from "@/lib/hooks/usePositions";
import { fmtUSD } from "@/lib/mock/data";
import { POOL_ADDRESS } from "@/lib/contracts";
import { type Address } from "viem";
import { TokenPill } from "@/components/app/shared/TokenPill";
import { Badge } from "@/components/app/shared/Badge";
import { typography as t, color as c } from "@/constants";

function PositionRow({
  tokenId,
  poolAddress,
  tickIndex,
  rWad,
  pool,
}: {
  tokenId: bigint;
  poolAddress: Address;
  tickIndex: number;
  rWad: bigint;
  pool: ReturnType<typeof usePool>["pool"];
}) {
  const tick = useTickStatus(poolAddress, tickIndex, !!pool);
  const rUSD = fmtWad(rWad);

  return (
    <div
      style={{
        border: `1px solid ${tick.isInterior ? color.border : color.warning + "44"}`,
        backgroundColor: color.surface1,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${color.borderSubtle}` }}
      >
        <div className="flex items-center gap-3">
          <span
            style={{
              fontFamily: "var(--font-mono)", fontSize: "10px",
              letterSpacing: "0.06em", color: color.textMuted,
              border: `1px solid ${color.borderSubtle}`, padding: "1px 6px",
            }}
          >
            #{tokenId.toString()}
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {pool?.tokens.map(tk => (
              <TokenPill key={tk.address} token={tk} size="sm" />
            ))}
          </div>
        </div>
        <Badge variant={tick.isInterior ? "success" : "warning"} dot>
          {tick.isInterior ? "Active" : "Paused"}
        </Badge>
      </div>

      {/* Stats */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 gap-px"
        style={{ backgroundColor: color.borderSubtle, borderBottom: `1px solid ${color.borderSubtle}` }}
      >
        {[
          { label: "Liquidity", value: rUSD },
          { label: "Tick",      value: `#${tickIndex}` },
          { label: "Status",    value: tick.isInterior ? "Earning fees" : "Paused", accent: tick.isInterior },
        ].map(s => (
          <div key={s.label} className="px-4 py-3" style={{ backgroundColor: color.surface1 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.07em", textTransform: "uppercase" as const, color: color.textMuted, marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: typography.h3.family, fontSize: "16px", fontWeight: 500, letterSpacing: "-0.02em", color: s.accent ? color.accent : color.textPrimary }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Actions — disabled, wiring future */}
      <div className="flex gap-2 px-4 py-3">
        {(["Increase", "Decrease", "Collect", "Burn"] as const).map(label => (
          <button
            key={label}
            disabled
            style={{
              border: `1px solid ${color.borderSubtle}`,
              backgroundColor: "transparent",
              color: color.textMuted,
              fontFamily: typography.p3.family,
              fontSize: typography.p3.size,
              letterSpacing: "-0.01em",
              padding: "6px 12px",
              cursor: "not-allowed",
              opacity: 0.5,
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PositionsPage() {
  const { address } = useAccount();
  const { pool }    = usePool(POOL_ADDRESS);
  const { positions, isLoading } = usePositions(address);

  const totalR = positions.reduce((s, p) => s + Number(p.rWad), 0);

  return (
    <div className="flex flex-col overflow-hidden w-full" style={{ height: "calc(100vh - 5.5rem)" }}>
      <div className="flex-1 min-h-0 flex flex-col" style={{ border: `1px solid ${color.border}` }}>

        {/* Header */}
        <div
          className="flex items-end justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: `1px solid ${color.borderSubtle}` }}
        >
          <div>
            <h1
              style={{
                fontFamily: typography.h2.family,
                fontSize: typography.h2.size,
                fontWeight: 500,
                letterSpacing: typography.h2.letterSpacing,
                color: color.textPrimary,
              }}
            >
              Positions
            </h1>
            <p style={{ fontFamily: typography.p2.family, fontSize: typography.p2.size, color: color.textMuted, marginTop: 4 }}>
              {!address
                ? "Connect wallet to view positions"
                : isLoading
                ? "Loading…"
                : `${positions.length} position${positions.length !== 1 ? "s" : ""} · ${fmtUSD(totalR / 1e18)} total`}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
          {!address ? (
            <div style={{ color: color.textMuted, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
              Connect your wallet to see your positions.
            </div>
          ) : isLoading ? (
            <div style={{ color: color.textMuted, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
              Fetching positions…
            </div>
          ) : positions.length === 0 ? (
            <div style={{ color: color.textMuted, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
              No positions found. Add liquidity to get started.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {positions.map(pos => (
                <PositionRow
                  key={pos.tokenId.toString()}
                  tokenId={pos.tokenId}
                  poolAddress={pos.poolAddress}
                  tickIndex={pos.tickIndex}
                  rWad={pos.rWad}
                  pool={pool}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
