import SvgTooltip from "./SvgTooltip";
import { COINS } from "@/lib/simulation";
import type { TickWithS, ReserveDot } from "@/lib/simulation";

interface RingsGeo {
  N:           number;
  q:           number;
  cx:          number;
  cy:          number;
  maxR:        number;
  ticksWithS:  TickWithS[];
  maxS:        number;
  scale:       number;
  reserveDot:  ReserveDot | null;
  tooltipPos:  (rSvg: number) => [number, number];
}

interface Props {
  geo:         RingsGeo;
  hoveredTick: number | null;
  onHover:     (i: number | null) => void;
}

export default function RingsView({ geo, hoveredTick, onHover }: Props) {
  const { N, q, cx, cy, maxR, ticksWithS, maxS, scale, reserveDot, tooltipPos } = geo;
  const f = (v: number) => v.toFixed(3);

  const hovered = hoveredTick !== null ? ticksWithS.find(t => t.index === hoveredTick) ?? null : null;

  return (
    <>
      {/* Coin axes */}
      {COINS.map((coin, i) => {
        const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
        const lx    = cx + Math.cos(angle) * maxR;
        const ly    = cy + Math.sin(angle) * maxR;
        const lxL   = cx + Math.cos(angle) * (maxR + 22);
        const lyL   = cy + Math.sin(angle) * (maxR + 22);
        return (
          <g key={coin}>
            <line x1={cx} y1={cy} x2={lx} y2={ly} stroke="var(--color-primary)" strokeWidth={0.6} strokeOpacity={0.15} />
            <circle cx={lx} cy={ly} r={2} fill="var(--color-primary)" fillOpacity={0.28} />
            <text x={lxL} y={lyL+3} fontSize={9} fontFamily="monospace" fill="var(--color-secondary)" fillOpacity={0.7} textAnchor="middle">{coin}</text>
          </g>
        );
      })}

      {/* Tick rings — outermost first */}
      {[...ticksWithS].sort((a, b) => b.sEff - a.sEff).map(tick => {
        const rSvg  = tick.sEff * scale;
        const isHov = hoveredTick === tick.index;
        const frac  = maxS > 0 ? tick.sEff / maxS : 0;
        return (
          <g key={tick.index}>
            <circle cx={cx} cy={cy} r={rSvg}
              fill="var(--color-primary)" fillOpacity={isHov ? 0.055 : 0.01 + frac * 0.02}
              style={{ transition: "fill-opacity 0.15s" }} />
            <circle cx={cx} cy={cy} r={rSvg} fill="none"
              stroke={tick.isInterior ? "var(--color-primary)" : "#facc15"}
              strokeWidth={isHov ? 1.6 : 0.7 + frac * 0.7}
              strokeOpacity={isHov ? 0.8 : 0.15 + frac * 0.35}
              strokeDasharray={tick.isInterior ? "none" : "4 3"}
              style={{ transition: "stroke-opacity 0.15s, stroke-width 0.15s" }} />
            <text
              x={cx + rSvg * Math.cos(-Math.PI * 0.62) + 5}
              y={cy + rSvg * Math.sin(-Math.PI * 0.62) - 3}
              fontSize={isHov ? 9 : 7.5} fontFamily="monospace"
              fill="var(--color-tertiary)" fillOpacity={isHov ? 0.85 : 0.38}
              style={{ transition: "fill-opacity 0.15s" }}>
              T{tick.index+1}
            </text>
            <circle cx={cx} cy={cy} r={rSvg} fill="none" stroke="transparent" strokeWidth={14}
              style={{ cursor: "default" }}
              onMouseEnter={() => onHover(tick.index)} onMouseLeave={() => onHover(null)} />
          </g>
        );
      })}

      {/* Reserve dot */}
      {reserveDot && (
        <g>
          <line x1={cx} y1={cy} x2={reserveDot.svgX} y2={reserveDot.svgY}
            stroke="#4ade80" strokeWidth={0.8} strokeOpacity={0.28} strokeDasharray="3 4" />
          <circle cx={reserveDot.svgX} cy={reserveDot.svgY} r={9} fill="#4ade80" fillOpacity={0.07} />
          <circle cx={reserveDot.svgX} cy={reserveDot.svgY} r={4} fill="none" stroke="#4ade80" strokeWidth={1.4} strokeOpacity={0.6} />
          <circle cx={reserveDot.svgX} cy={reserveDot.svgY} r={2.5} fill="#4ade80" />
          <text
            x={reserveDot.svgX + (reserveDot.svgX > cx ? 9 : -9)}
            y={reserveDot.svgY - 8}
            fontSize={8.5} fontFamily="monospace" fill="#4ade80" fillOpacity={0.85}
            textAnchor={reserveDot.svgX > cx ? "start" : "end"}>
            α = {f(reserveDot.alpha)}
          </text>
        </g>
      )}

      {/* Center q */}
      <circle cx={cx} cy={cy} r={26} fill="url(#sp-ringGrad)" />
      <circle cx={cx} cy={cy} r={5}   fill="none" stroke="var(--color-primary)" strokeWidth={1.4} strokeOpacity={0.55} />
      <circle cx={cx} cy={cy} r={2.5} fill="var(--color-primary)" fillOpacity={0.85} />
      <text x={cx+9} y={cy-9} fontSize={9} fontFamily="monospace" fill="var(--color-primary)" fillOpacity={0.6}>q = {f(q)}</text>

      {/* Hover tooltip */}
      {hovered && (() => {
        const rSvg = hovered.sEff * scale;
        const [ttx, tty] = tooltipPos(rSvg);
        return (
          <SvgTooltip x={ttx} y={tty} width={196} rowHeight={15} rows={[
            ["tick",       `#${hovered.index+1}`],
            ["k boundary", f(hovered.k)],
            ["k/r",        hovered.kNorm.toFixed(4)],
            ["s (ring r)", f(hovered.sEff)],
            ["r contrib",  f(hovered.r)],
            ["liquidity",  hovered.liquidityGross.toLocaleString()],
            ["type",       hovered.isInterior ? "interior" : "boundary"],
          ]} />
        );
      })()}
    </>
  );
}
