import { color, colors, typography } from "@/constants";
import { SectionLabel } from "./SectionLabel";

const HEADLINE_STATS = [
  { k: "TVL", v: "2.14", unit: "M", prefix: "$", delta: "+2.4%", positive: true },
  { k: "24H VOLUME", v: "341", unit: "K", prefix: "$", delta: "+18.1%", positive: true },
  { k: "24H FEES", v: "1,024", unit: "", prefix: "$", delta: "+18.1%", positive: true },
] as const;

const SECONDARY_STATS = [
  { k: "ACTIVE TICKS", v: "3", suffix: " / 4", tone: "warn" as const, note: "1 BOUNDARY" },
  { k: "CAPITAL EFFICIENCY", v: "154", suffix: "×", tone: "accent" as const, note: "VS FLAT SPHERE" },
  { k: "ASSETS", v: "4", suffix: "", tone: "primary" as const, note: "USDC · USDT · DAI · FRAX" },
  { k: "POOL FEE", v: "0.30", suffix: "%", tone: "primary" as const, note: "BPS 30" },
  { k: "LP POSITIONS", v: "12", suffix: "", tone: "primary" as const, note: "4 OWNERS" },
  { k: "SWAPS TODAY", v: "87", suffix: "", tone: "primary" as const, note: "AVG $3.9K" },
] as const;

export function StatsStrip() {
  return (
    <section
      className="border-b border-dashed"
      style={{ borderColor: color.border }}
    >
      <SectionLabel chapter="II" section="01" path="PROTOCOL / STATS" />

      {/* Chapter heading row, same proportions as Masthead */}
      <div className="flex items-start justify-between gap-6 px-6 pt-14 pb-8">
        <span
          style={{
            fontFamily: typography.h1.family,
            fontSize: "clamp(72px, 10vw, 148px)",
            lineHeight: "0.85",
            color: color.textMuted,
            opacity: 0.55,
            fontWeight: 300,
            letterSpacing: "-0.05em",
          }}
        >
          II
        </span>
        <h2
          className="text-right"
          style={{
            fontFamily: typography.h1.family,
            fontSize: "clamp(44px, 7vw, 108px)",
            lineHeight: "0.9",
            letterSpacing: "-0.055em",
            fontWeight: 500,
            color: color.textPrimary,
          }}
        >
          Stats
        </h2>
      </div>

      {/* Headline trio — TVL / Volume / Fees, huge numbers */}
      <div
        className="grid grid-cols-1 md:grid-cols-3 border-t border-dashed"
        style={{ borderColor: color.borderSubtle }}
      >
        {HEADLINE_STATS.map((s, i) => (
          <div
            key={s.k}
            className="px-6 py-10 flex flex-col gap-4"
            style={{
              borderRight:
                i < HEADLINE_STATS.length - 1
                  ? `1px dashed ${color.borderSubtle}`
                  : "none",
              borderBottom: `1px dashed ${color.borderSubtle}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.1em",
                  color: color.textMuted,
                  textTransform: "uppercase",
                }}
              >
                {s.k}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  color: s.positive ? colors.green.hex : colors.red.hex,
                }}
              >
                {s.delta}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span
                style={{
                  fontFamily: typography.h1.family,
                  fontSize: "clamp(48px, 6vw, 88px)",
                  lineHeight: "0.95",
                  letterSpacing: "-0.05em",
                  color: color.textPrimary,
                  fontWeight: 400,
                }}
              >
                <span style={{ color: color.textMuted }}>{s.prefix}</span>
                {s.v}
                {s.unit && (
                  <span style={{ color: color.textMuted }}>{s.unit}</span>
                )}
              </span>
            </div>
            <MiniSparkline positive={s.positive} />
          </div>
        ))}
      </div>

      {/* Secondary stats row, mono readouts */}
      <div className="grid grid-cols-2 md:grid-cols-6">
        {SECONDARY_STATS.map((s, i) => (
          <div
            key={s.k}
            className="px-5 py-5 flex flex-col gap-2"
            style={{
              borderRight:
                (i + 1) % (typeof window === "undefined" ? 6 : 6) !== 0 &&
                i < SECONDARY_STATS.length - 1
                  ? `1px dashed ${color.borderSubtle}`
                  : undefined,
              borderBottom: `1px dashed ${color.borderSubtle}`,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: color.textMuted,
                textTransform: "uppercase",
              }}
            >
              {s.k}
            </span>
            <span
              style={{
                fontFamily: typography.h2.family,
                fontSize: "32px",
                lineHeight: "34px",
                letterSpacing: "-0.04em",
                color:
                  s.tone === "accent"
                    ? colors.purple.hex
                    : s.tone === "warn"
                    ? colors.yellow.hex
                    : color.textPrimary,
                fontWeight: 400,
              }}
            >
              {s.v}
              <span style={{ color: color.textMuted, fontWeight: 300 }}>
                {s.suffix}
              </span>
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.06em",
                color: color.textMuted,
                textTransform: "uppercase",
              }}
            >
              {s.note}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MiniSparkline({ positive }: { positive: boolean }) {
  const data = [6, 8, 5, 9, 7, 10, 8, 12, 9, 14, 11, 15, 13, 17, 15, 18];
  const W = 200;
  const H = 36;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((d - min) / (max - min)) * (H - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPoints = `${points} L${W},${H} L0,${H} Z`;
  const stroke = positive ? colors.green.hex : colors.red.hex;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="mt-2">
      <path d={areaPoints} fill={stroke} opacity={0.08} />
      <path d={points} fill="none" stroke={stroke} strokeWidth={1.2} />
    </svg>
  );
}
