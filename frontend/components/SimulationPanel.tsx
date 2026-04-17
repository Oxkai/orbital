"use client";

import { useState } from "react";
import type { TickData } from "@/lib/usePoolData";
import { COINS, type Coin, type Tab, type Reserves, buildCurveGeometry, buildRingsGeometry } from "@/lib/simulation";
import TabBar       from "@/components/simulation/TabBar";
import PairSelector from "@/components/simulation/PairSelector";
import CurveView    from "@/components/simulation/CurveView";
import RingsView    from "@/components/simulation/RingsView";

interface Props {
  radius:   number;
  reserves: Reserves;
  ticks?:   TickData[];
  nAssets?: number;
  size?:    number;
}

export default function SimulationPanel({
  radius,
  reserves,
  ticks: onChainTicks = [],
  nAssets = 4,
  size = 480,
}: Props) {
  const [tab,         setTab]         = useState<Tab>("curve");
  const [coinA,       setCoinA]       = useState<Coin>("USDC");
  const [coinB,       setCoinB]       = useState<Coin>("DAI");
  const [hoveredTick, setHoveredTick] = useState<number | null>(null);

  const r = radius > 0 ? radius : 100;

  const curveGeo = buildCurveGeometry(r, size, coinA, coinB, reserves, onChainTicks);
  const ringsGeo = buildRingsGeometry(r, size, nAssets, reserves, onChainTicks);

  function handleTab(t: Tab) {
    setHoveredTick(null);
    setTab(t);
  }

  return (
    <div className="flex flex-col select-none w-full h-full rounded-lg overflow-hidden" style={{ background: "var(--color-surface)" }}>

      <TabBar
        tab={tab} onTab={handleTab}
        coinA={coinA} coinB={coinB}
        rx={curveGeo.rx} ry={curveGeo.ry}
        slope={curveGeo.slope} alpha={curveGeo.alpha}
      />

      {tab === "curve" && (
        <PairSelector
          coinA={coinA} coinB={coinB}
          onCoinA={setCoinA} onCoinB={setCoinB}
        />
      )}

      <div className="flex-1 min-h-0">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full"
          style={{ background: "transparent" }}
          onMouseLeave={() => setHoveredTick(null)}
        >
          <defs>
            <linearGradient id="sp-arcGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity="0.5" />
              <stop offset="50%"  stopColor="var(--color-primary)" stopOpacity="1"   />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.5" />
            </linearGradient>
<radialGradient id="sp-ringGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0"    />
            </radialGradient>
          </defs>

          {tab === "curve" && (
            <CurveView
              geo={curveGeo} size={size}
              coinA={coinA} coinB={coinB}
              hoveredTick={hoveredTick} onHover={setHoveredTick}
            />
          )}

          {tab === "rings" && (
            <RingsView
              geo={ringsGeo}
              hoveredTick={hoveredTick} onHover={setHoveredTick}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
