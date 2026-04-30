"use client";

import {
  AreaChart, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { color, typography } from "@/constants";
interface PriceChartProps {
  tokenIn?: number;
  tokenOut?: number;
  inSymbol?: string;
  outSymbol?: string;
}

function buildPriceData() {
  const base = 1.0;
  return Array.from({ length: 25 }, (_, i) => ({
    label: `${i}:00`,
    price: parseFloat(
      (base + Math.sin(i * 0.5) * 0.000008 + Math.sin(i * 0.2) * 0.000003).toFixed(6)
    ),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        border: `1px solid ${color.border}`,
        backgroundColor: color.surface2,
        padding: "8px 12px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.06em",
          color: color.textMuted,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          color: color.textPrimary,
        }}
      >
        {payload[0].value.toFixed(5)}
      </div>
    </div>
  );
}

export function PriceChart({ inSymbol = "A", outSymbol = "B" }: PriceChartProps) {
  const data    = buildPriceData();
  const inSym   = inSymbol;
  const outSym  = outSymbol;
  const current = data[data.length - 1].price;
  const open    = data[0].price;
  const delta   = ((current - open) / open) * 100;
  const isUp    = delta >= 0;

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: color.surface1 }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `1px solid ${color.borderSubtle}` }}
      >
        <div className="flex items-center gap-3">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: color.textPrimary,
            }}
          >
            {inSym}/{outSym}
          </span>
          <span
            style={{
              fontFamily: typography.h3.family,
              fontSize: "18px",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: color.textPrimary,
            }}
          >
            {current.toFixed(5)}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: isUp ? color.success : color.error,
            }}
          >
            {isUp ? "+" : ""}{delta.toFixed(4)}%
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: color.textMuted,
          }}
        >
          24H
        </span>
      </div>

      {/* Chart — fills remaining height */}
      <div className="flex-1 min-h-0" style={{ padding: "12px 0 0" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color.accent} stopOpacity={0.18} />
                <stop offset="95%" stopColor={color.accent} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fill: color.textMuted, fontSize: 9, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              interval={5}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: color.textMuted, fontSize: 9, fontFamily: "var(--font-mono)" }}
              axisLine={false}
              tickLine={false}
              width={56}
              tickFormatter={(v: number) => v.toFixed(4)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: color.borderSubtle, strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={color.accent}
              strokeWidth={1.5}
              fill="url(#priceGrad)"
              dot={false}
              activeDot={{ r: 3, fill: color.accent, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
