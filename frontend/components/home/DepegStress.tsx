"use client";

import { useMemo, useState } from "react";
import { color, colors, typography } from "@/constants";
import { SectionLabel } from "./SectionLabel";

const TICKS = [
  { label: "TIGHT", k: 1.05, r: 0.4, flipsAt: 0.5 },
  { label: "BALANCED", k: 1.15, r: 0.3, flipsAt: 1.5 },
  { label: "WIDE", k: 1.275, r: 0.2, flipsAt: 2.75 },
  { label: "BACKSTOP", k: 1.375, r: 0.1, flipsAt: 3.75 },
] as const;

export function DepegStress() {
  const [depeg, setDepeg] = useState(0.4);

  const state = useMemo(() => {
    const shifted = TICKS.map((t) => ({
      ...t,
      isBoundary: depeg > t.flipsAt,
    }));
    const interiorCount = shifted.filter((t) => !t.isBoundary).length;
    const interiorR = shifted
      .filter((t) => !t.isBoundary)
      .reduce((acc, t) => acc + t.r, 0);
    const totalR = TICKS.reduce((acc, t) => acc + t.r, 0);
    return {
      shifted,
      interiorCount,
      interiorR,
      interiorPct: (interiorR / totalR) * 100,
    };
  }, [depeg]);

  const severity =
    depeg > 3 ? "critical" : depeg > 1.5 ? "warn" : depeg > 0.5 ? "alert" : "ok";
  const severityColor = {
    ok: colors.green.hex,
    alert: colors.yellow.hex,
    warn: colors.yellow.hex,
    critical: colors.red.hex,
  }[severity];

  return (
    <section
      className="border-b border-dashed"
      style={{ borderColor: color.border }}
    >
      <SectionLabel
        chapter="IV"
        section="03"
        path="PROTOCOL / STRESS TEST"
      />

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
          IV
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
          Stress Test
        </h2>
      </div>

      <div
        className="px-6 pb-10 border-b border-dashed"
        style={{ borderColor: color.borderSubtle }}
      >
        <p
          style={{
            fontFamily: typography.h2.family,
            fontSize: "clamp(22px, 2.4vw, 32px)",
            lineHeight: "1.2",
            letterSpacing: "-0.025em",
            color: color.textPrimary,
            maxWidth: "62ch",
          }}
        >
          Push <span style={{ color: colors.red.hex }}>USDT</span> off peg.{" "}
          <span style={{ color: color.textMuted }}>
            As the reserve vector crosses each tick&rsquo;s plane, that tick
            flips to boundary — its liquidity leaves the interior and the
            depegging asset gets contained inside it.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left — visual */}
        <div
          className="lg:col-span-7 relative"
          style={{
            backgroundColor: color.surface1,
            borderRight: `1px dashed ${color.borderSubtle}`,
          }}
        >
          <div
            className="absolute top-4 left-6 right-6 flex items-center justify-between z-10"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              letterSpacing: "0.1em",
              color: color.textMuted,
              textTransform: "uppercase",
            }}
          >
            <span>/ A   RESERVE VECTOR x(t)</span>
            <span style={{ color: severityColor }}>● {severity.toUpperCase()}</span>
          </div>
          <StressSvg depeg={depeg} ticks={state.shifted} />
        </div>

        {/* Right — controls */}
        <div className="lg:col-span-5 flex flex-col">
          {/* Control */}
          <div
            className="px-6 py-8 border-b border-dashed"
            style={{ borderColor: color.borderSubtle }}
          >
            <div
              className="flex items-baseline justify-between mb-5"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.1em",
                color: color.textMuted,
                textTransform: "uppercase",
              }}
            >
              <span>/ B   USDT DEPEG</span>
              <span>DRAG ↔</span>
            </div>
            <div className="flex items-baseline gap-4 mb-5">
              <span
                style={{
                  fontFamily: typography.h1.family,
                  fontSize: "clamp(64px, 8vw, 112px)",
                  lineHeight: "0.9",
                  letterSpacing: "-0.055em",
                  fontWeight: 400,
                  color: severityColor,
                }}
              >
                {depeg.toFixed(1)}
                <span style={{ color: color.textMuted, fontWeight: 300 }}>%</span>
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  color: color.textMuted,
                }}
              >
                BELOW $1.00
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              value={depeg}
              onChange={(e) => setDepeg(parseFloat(e.target.value))}
              className="w-full"
              style={{ accentColor: colors.purple.hex }}
            />
            <div
              className="flex justify-between mt-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: color.textMuted,
                letterSpacing: "0.06em",
              }}
            >
              <span>0.0%</span>
              <span>2.5%</span>
              <span>5.0%</span>
            </div>
          </div>

          {/* Tick list */}
          <div
            className="px-6 py-6 border-b border-dashed"
            style={{ borderColor: color.borderSubtle }}
          >
            <div
              className="mb-3"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.1em",
                color: color.textMuted,
                textTransform: "uppercase",
              }}
            >
              / C   TICK STATE
            </div>
            <div className="flex flex-col">
              {state.shifted.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center justify-between px-3 py-3 border-b border-dashed"
                  style={{
                    borderColor: color.borderSubtle,
                    backgroundColor: t.isBoundary ? `${colors.red.hex}10` : "transparent",
                    transition: "background-color 200ms ease-out",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: t.isBoundary ? colors.red.hex : colors.green.hex,
                        transition: "background-color 200ms",
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: t.isBoundary ? colors.red.hex : color.textPrimary,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {t.label}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: color.textMuted,
                      }}
                    >
                      k={t.k.toFixed(3)}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "0.1em",
                      color: t.isBoundary ? colors.red.hex : colors.green.hex,
                    }}
                  >
                    {t.isBoundary ? "BOUNDARY" : "INTERIOR"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div
            className="grid grid-cols-2"
            style={{ borderTop: "none" }}
          >
            <Stat
              k="INTERIOR TICKS"
              v={`${state.interiorCount}`}
              tail={` / ${TICKS.length}`}
              border
            />
            <Stat
              k="INTERIOR rInt"
              v={`${state.interiorPct.toFixed(0)}`}
              tail="%"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  k,
  v,
  tail,
  border,
}: {
  k: string;
  v: string;
  tail?: string;
  border?: boolean;
}) {
  return (
    <div
      className="px-6 py-6"
      style={{
        borderRight: border ? `1px dashed ${color.borderSubtle}` : undefined,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.1em",
          color: color.textMuted,
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {k}
      </div>
      <div
        style={{
          fontFamily: typography.h1.family,
          fontSize: "44px",
          lineHeight: "48px",
          letterSpacing: "-0.05em",
          color: color.textPrimary,
          fontWeight: 400,
        }}
      >
        {v}
        {tail && <span style={{ color: color.textMuted, fontWeight: 300 }}>{tail}</span>}
      </div>
    </div>
  );
}

function StressSvg({
  depeg,
  ticks,
}: {
  depeg: number;
  ticks: readonly { label: string; k: number; isBoundary: boolean }[];
}) {
  const W = 560;
  const H = 440;
  const cx = W / 2;
  const cy = H / 2 + 10;
  const r = 150;

  const angle = -Math.PI / 2 + (depeg / 5) * Math.PI * 0.55;
  const dotX = cx + Math.cos(angle) * r;
  const dotY = cy + Math.sin(angle) * r;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      {/* Outer ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r + 22}
        fill="none"
        stroke={color.borderSubtle}
        strokeWidth={0.5}
        strokeDasharray="2 6"
      />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color.border} strokeWidth={1} />

      {/* Tick rings */}
      {ticks.map((t, i) => {
        const rad = r * (1 - (t.k - 1) * 2);
        return (
          <g key={t.label}>
            <circle
              cx={cx}
              cy={cy}
              r={rad}
              fill="none"
              stroke={t.isBoundary ? colors.red.hex : colors.purple.hex}
              strokeWidth={1}
              strokeDasharray={t.isBoundary ? "2 3" : "4 3"}
              opacity={t.isBoundary ? 0.4 : 0.65 - i * 0.08}
            />
            <text
              x={cx + rad + 6}
              y={cy + 3}
              fill={t.isBoundary ? colors.red.hex : color.textMuted}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.06em",
              }}
            >
              {t.label}
            </text>
          </g>
        );
      })}

      {/* Crosshair */}
      <line x1={cx} y1={cy - r - 30} x2={cx} y2={cy + r + 30} stroke={color.borderSubtle} strokeWidth={0.5} strokeDasharray="2 4" />
      <line x1={cx - r - 30} y1={cy} x2={cx + r + 30} y2={cy} stroke={color.borderSubtle} strokeWidth={0.5} strokeDasharray="2 4" />

      {/* Asset labels */}
      {["USDC", "USDT", "DAI", "FRAX"].map((tk, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 4;
        const lx = cx + Math.cos(a) * (r + 44);
        const ly = cy + Math.sin(a) * (r + 44);
        const isDepegging = tk === "USDT" && depeg > 0;
        return (
          <g key={tk}>
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isDepegging ? colors.red.hex : color.textMuted}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                letterSpacing: "0.1em",
              }}
            >
              {tk}
            </text>
            {isDepegging && (
              <text
                x={lx}
                y={ly + 14}
                textAnchor="middle"
                fill={colors.red.hex}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "9px",
                  letterSpacing: "0.08em",
                }}
              >
                −{depeg.toFixed(1)}%
              </text>
            )}
          </g>
        );
      })}

      {/* Vector from center to reserve */}
      <line
        x1={cx}
        y1={cy}
        x2={dotX}
        y2={dotY}
        stroke={colors.purple.hex}
        strokeDasharray="2 2"
        strokeWidth={1}
      />
      <circle cx={dotX} cy={dotY} r={22} fill={colors.purple.hex} opacity={0.12} />
      <circle cx={dotX} cy={dotY} r={12} fill={colors.purple.hex} opacity={0.28} />
      <circle cx={dotX} cy={dotY} r={5} fill={colors.purple.hex} />

      {/* Readout corners */}
      <text
        x={20}
        y={H - 14}
        fill={color.textMuted}
        style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em" }}
      >
        ‖x − r·1̂‖² = r²
      </text>
      <text
        x={W - 20}
        y={H - 14}
        textAnchor="end"
        fill={color.textMuted}
        style={{ fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em" }}
      >
        N = 4
      </text>
    </svg>
  );
}
