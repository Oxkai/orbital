"use client";

import { color, typography } from "@/constants";
import { PoolCard } from "@/components/app/pools/PoolCard";
import { usePool } from "@/lib/hooks/usePool";
import { fmtUSD } from "@/lib/mock/data";
import { POOL_ADDRESSES } from "@/lib/contracts";
import type { Address } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;
function useAllPools(addresses: readonly Address[]) {
  const a = usePool(addresses[0] ?? ZERO);
  const b = usePool(addresses[1] ?? ZERO);
  const c = usePool(addresses[2] ?? ZERO);
  const d = usePool(addresses[3] ?? ZERO);
  return [a, b, c, d].slice(0, addresses.length);
}

export default function PoolsPage() {
  const poolHooks = useAllPools(POOL_ADDRESSES);

  const isLoading = poolHooks.some(p => p.isLoading);
  const isError   = poolHooks.every(p => p.isError);
  const pools     = poolHooks.map(p => p.pool).filter(Boolean) as NonNullable<ReturnType<typeof usePool>["pool"]>[];
  const tvl = pools.reduce((a, p) => a + p.tvl, 0);
  const vol = pools.reduce((a, p) => a + p.volume24h, 0);

  return (
    <div
      className="flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100vh - 5.5rem)" }}
    >
      <div
        className="flex-1 min-h-0 grid grid-cols-[80px_1fr_80px]"
        style={{ border: `1px solid ${color.border}` }}
      >
        {/* left decorative col */}
        <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderRight: `1px solid ${color.border}` }} />

        {/* main content */}
        <div className="min-h-0 flex flex-col">
          {/* Header */}
          <div
            className="flex items-end justify-between px-5 py-4 shrink-0"
            style={{ borderBottom: `1px solid ${color.borderSubtle}` }}
          >
            <div className="flex flex-col">
              <h1
                style={{
                  fontFamily: typography.h2.family,
                  fontSize: typography.h2.size,
                  fontWeight: 500,
                  letterSpacing: typography.h2.letterSpacing,
                  color: color.textPrimary,
                }}
              >
                Pools
              </h1>
              <p
                style={{
                  fontFamily: typography.p2.family,
                  fontSize: typography.p2.size,
                  color: color.textMuted,
                  marginTop: 4,
                }}
              >
                {isLoading
                  ? "Loading…"
                  : isError
                    ? "Error loading pool data"
                    : `${pools.length} pool${pools.length !== 1 ? "s" : ""} · ${fmtUSD(tvl)} TVL · ${fmtUSD(vol)} 24h vol`}
              </p>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {isLoading && (
              <div className="px-5 py-4"
                style={{ color: color.textMuted, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                Fetching on-chain data…
              </div>
            )}
            {isError && !isLoading && (
              <div className="px-5 py-4"
                style={{ color: color.error, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                Failed to load pool. Check RPC connection.
              </div>
            )}
            {!isLoading && !isError && (
              <div className="flex flex-col">
                {pools.map((p) => (
                  <PoolCard key={p.address} pool={p} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* right decorative col */}
        <div style={{ backgroundImage: `repeating-linear-gradient(45deg, ${color.borderSubtle} 0, ${color.borderSubtle} 1px, transparent 0, transparent 50%)`, backgroundSize: "12px 12px", borderLeft: `1px solid ${color.border}` }} />
      </div>
    </div>
  );
}
