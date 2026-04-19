"use client";

import { useState, useRef, useEffect } from "react";
import type { TickData } from "@/lib/usePoolData";
import { type Reserves, buildRingsGeometry } from "@/lib/simulation";
import RingsView from "@/components/simulation/RingsView";

interface Props {
  radius:   number;
  reserves: Reserves;
  ticks?:   TickData[];
  nAssets?: number;
  sumX?:    number;
  sumXSq?:  number;
  kBound?:  number;
  sBound?:  number;
}

export default function SimulationPanel({
  radius,
  reserves,
  ticks: onChainTicks = [],
  nAssets = 4,
  sumX = 0,
  sumXSq = 0,
  kBound = 0,
  sBound = 0,
}: Props) {
  const [hoveredTick, setHoveredTick] = useState<number | null>(null);
  const [zoom, setZoom] = useState<number>(5);
  const [svgW, setSvgW] = useState<number>(480);
  const [svgH, setSvgH] = useState<number>(480);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = svgContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSvgW(width);
      setSvgH(height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const r = radius > 0 ? radius : 100;
  const ringsGeo = buildRingsGeometry(r, svgW, nAssets, reserves, onChainTicks, zoom, svgH);

  return (
    <div
      className="flex flex-col select-none w-full h-full rounded-xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 gap-4">
        <span className="text-[10px] font-mono" style={{ color: "var(--color-primary)" }}>Tick Rings</span>
        <div className="flex items-center gap-3 text-[9px] font-mono" style={{ color: "var(--color-tertiary)" }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: "var(--color-primary)", opacity: 0.6 }} />
            q
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t" style={{ borderColor: "var(--color-secondary)", opacity: 0.5 }} />
            interior
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 border-t border-dashed" style={{ borderColor: "#facc15", opacity: 0.7 }} />
            boundary
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#4ade80" }} />
            reserves
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div ref={svgContainerRef} className="flex-1 min-h-0 w-full">
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            width="100%" height="100%"
            style={{ background: "transparent", display: "block" }}
            onMouseLeave={() => setHoveredTick(null)}
          >
            <defs>
              <radialGradient id="sp-ringGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity="0.1" />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0"   />
              </radialGradient>
              <clipPath id="sp-rings-clip">
                <rect x={0} y={0} width={svgW} height={svgH} />
              </clipPath>
            </defs>
            <g clipPath="url(#sp-rings-clip)">
              <RingsView
                geo={ringsGeo}
                hoveredTick={hoveredTick} onHover={setHoveredTick}
              />
            </g>
          </svg>
        </div>

        {/* Zoom strip */}
        {(() => {
          const z = zoom;
          const setZ = setZoom;
          return (
            <div className="shrink-0 px-6 py-2.5 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--color-border)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono tracking-widest uppercase" style={{ color: "var(--color-tertiary)" }}>zoom</span>
                <span className="text-[10px] font-mono font-medium" style={{ color: "var(--color-primary)" }}>{z.toFixed(1)}x</span>
              </div>
              <div className="relative">
                <input
                  type="range" min={0} max={80} step={0.1}
                  value={z}
                  onChange={e => setZ(parseFloat(e.target.value))}
                  className="w-full h-1 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "var(--color-primary)" }}
                />
                <div className="flex justify-between mt-1 px-px">
                  {[0,10,20,30,40,50,60,70,80].map(v => (
                    <button key={v} onClick={() => setZ(v)} className="flex flex-col items-center gap-0.5">
                      <span className="w-px h-1.5 rounded-full transition-colors"
                        style={{ background: z >= v ? "var(--color-primary)" : "var(--color-border-strong)" }} />
                      <span className="text-[7px] font-mono transition-colors"
                        style={{ color: z >= v ? "var(--color-primary)" : "var(--color-tertiary)" }}>{v}x</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
