import SvgTooltip from "./SvgTooltip";
import type { Coin, Tick2D } from "@/lib/simulation";

interface CurveGeo {
  PAD:      number;
  DOMAIN:   number;
  sx:       (v: number) => number;
  sy:       (v: number) => number;
  q:        number;
  rx:       number;
  ry:       number;
  arcPath:  string;
  ticks2D:  Tick2D[];
  tickLine: (S: number) => { x1: number; y1: number; x2: number; y2: number } | null;
}

interface Props {
  geo:         CurveGeo;
  size:        number;
  coinA:       Coin;
  coinB:       Coin;
  hoveredTick: number | null;
  onHover:     (i: number | null) => void;
}

export default function CurveView({ geo, size, coinA, coinB, hoveredTick, onHover }: Props) {
  const { PAD, sx, sy, q, rx, ry, arcPath, ticks2D, tickLine } = geo;
  const f = (v: number) => v.toFixed(2);
  const rpx = sx(rx), rpy = sy(ry);

  return (
    <>
      {/* Grid */}
      {Array.from({ length: 6 }, (_, i) => {
        const v = ((i + 1) / 5) * (geo.DOMAIN / 1.1);
        return (
          <g key={i} opacity={0.35}>
            <line x1={sx(v)} y1={PAD} x2={sx(v)} y2={size - PAD} stroke="var(--color-border)" strokeWidth={0.5} />
            <line x1={PAD} y1={sy(v)} x2={size - PAD} y2={sy(v)} stroke="var(--color-border)" strokeWidth={0.5} />
          </g>
        );
      })}

      {/* X axis */}
      <line x1={PAD} y1={sy(0)} x2={size-PAD+10} y2={sy(0)} stroke="var(--color-secondary)" strokeWidth={1} strokeOpacity={0.5} />
      <polygon points={`${size-PAD+10},${sy(0)} ${size-PAD+2},${sy(0)-4} ${size-PAD+2},${sy(0)+4}`} fill="var(--color-secondary)" fillOpacity={0.4} />
      <text x={size-PAD+14} y={sy(0)+4} fontSize={11} fill="var(--color-secondary)" fillOpacity={0.7} fontFamily="monospace">{coinA}</text>

      {/* Y axis */}
      <line x1={sx(0)} y1={size-PAD} x2={sx(0)} y2={PAD-10} stroke="var(--color-secondary)" strokeWidth={1} strokeOpacity={0.5} />
      <polygon points={`${sx(0)},${PAD-10} ${sx(0)-4},${PAD-2} ${sx(0)+4},${PAD-2}`} fill="var(--color-secondary)" fillOpacity={0.4} />
      <text x={sx(0)} y={PAD-14} fontSize={11} fill="var(--color-secondary)" fillOpacity={0.7} fontFamily="monospace" textAnchor="middle">{coinB}</text>

      {/* Axis labels */}
      {([0, 0.5, 1] as const).map(t => {
        const r = geo.DOMAIN / 1.1;
        const v = t * r;
        const label = t === 0 ? "0" : t === 0.5 ? "r/2" : "r";
        return (
          <g key={t}>
            <line x1={sx(v)} y1={sy(0)-3} x2={sx(v)} y2={sy(0)+3} stroke="var(--color-tertiary)" strokeWidth={0.8} strokeOpacity={0.5} />
            <text x={sx(v)} y={sy(0)+14} fontSize={8} textAnchor="middle" fill="var(--color-tertiary)" fillOpacity={0.5} fontFamily="monospace">{label}</text>
            {t > 0 && <>
              <line x1={sx(0)-3} y1={sy(v)} x2={sx(0)+3} y2={sy(v)} stroke="var(--color-tertiary)" strokeWidth={0.8} strokeOpacity={0.5} />
              <text x={sx(0)-7} y={sy(v)+3} fontSize={8} textAnchor="end" fill="var(--color-tertiary)" fillOpacity={0.5} fontFamily="monospace">{label}</text>
            </>}
          </g>
        );
      })}

      {/* v̂ diagonal */}
      {(() => { const r = geo.DOMAIN / 1.1; return (
        <>
          <line x1={sx(0)} y1={sy(0)} x2={sx(r*0.9)} y2={sy(r*0.9)} stroke="var(--color-primary)" strokeWidth={0.7} strokeOpacity={0.1} strokeDasharray="3 5" />
          <text x={sx(r*0.52)} y={sy(r*0.52)-6} fontSize={8} fill="var(--color-tertiary)" fillOpacity={0.3} fontFamily="monospace">v̂</text>
        </>
      ); })()}

      {/* Arc */}
      <path d={arcPath} fill="none" stroke="var(--color-primary)" strokeWidth={14} strokeOpacity={0.04} />
      <path d={arcPath} fill="none" stroke="url(#sp-arcGrad)" strokeWidth={2.2} />

      {/* Arc endpoints */}
      {(() => { const r = geo.DOMAIN / 1.1; return (
        <>
          <circle cx={sx(0)} cy={sy(r)} r={3} fill="var(--color-primary)" fillOpacity={0.45} />
          <circle cx={sx(r)} cy={sy(0)} r={3} fill="var(--color-primary)" fillOpacity={0.45} />
          <text x={sx(0)+8} y={sy(r)-4} fontSize={7.5} fontFamily="monospace" fill="var(--color-tertiary)" fillOpacity={0.45}>(0,r)</text>
          <text x={sx(r)-4} y={sy(0)-6} fontSize={7.5} fontFamily="monospace" fill="var(--color-tertiary)" fillOpacity={0.45} textAnchor="middle">(r,0)</text>
        </>
      ); })()}

      {/* Equal-price q */}
      <line x1={sx(q)} y1={sy(0)} x2={sx(q)} y2={sy(q)} stroke="var(--color-primary)" strokeWidth={0.6} strokeOpacity={0.15} strokeDasharray="2 4" />
      <line x1={sx(0)} y1={sy(q)} x2={sx(q)} y2={sy(q)} stroke="var(--color-primary)" strokeWidth={0.6} strokeOpacity={0.15} strokeDasharray="2 4" />
      <circle cx={sx(q)} cy={sy(q)} r={5} fill="var(--color-primary)" fillOpacity={0.45} />
      <circle cx={sx(q)} cy={sy(q)} r={10} fill="none" stroke="var(--color-primary)" strokeWidth={0.8} strokeOpacity={0.18} />
      <text x={sx(q)+9} y={sy(q)-6} fontSize={8.5} fontFamily="monospace" fill="var(--color-primary)" fillOpacity={0.65}>q = {f(q)}</text>

      {/* Tick lines */}
      {ticks2D.map(tick => {
        const seg   = tickLine(tick.S);
        if (!seg) return null;
        const isHov = hoveredTick === tick.index;
        const midX  = (seg.x1 + seg.x2) / 2;
        const midY  = (seg.y1 + seg.y2) / 2;
        return (
          <g key={tick.index}>
            <line {...seg}
              stroke={tick.isInterior ? "var(--color-primary)" : "#facc15"}
              strokeWidth={isHov ? 1.6 : 0.9} strokeOpacity={isHov ? 0.75 : 0.28}
              strokeDasharray={tick.isInterior ? "none" : "5 4"}
              style={{ transition: "all 0.12s" }} />
            <text x={midX+5} y={midY-4} fontSize={isHov ? 9 : 7.5} fontFamily="monospace"
              fill={isHov ? "var(--color-primary)" : "var(--color-tertiary)"}
              fillOpacity={isHov ? 0.8 : 0.38}>T{tick.index+1}</text>
            <line {...seg} stroke="transparent" strokeWidth={16} style={{ cursor: "default" }}
              onMouseEnter={() => onHover(tick.index)} onMouseLeave={() => onHover(null)} />
            {tick.pt && (
              <circle cx={sx(tick.pt[0])} cy={sy(tick.pt[1])} r={isHov ? 4 : 2.5}
                fill={tick.isInterior ? "var(--color-primary)" : "#facc15"}
                fillOpacity={isHov ? 0.8 : 0.38} style={{ transition: "all 0.12s" }} />
            )}
          </g>
        );
      })}

      {/* Hover tooltip */}
      {hoveredTick !== null && (() => {
        const tick = ticks2D.find(t => t.index === hoveredTick);
        if (!tick) return null;
        const seg  = tickLine(tick.S);
        if (!seg)  return null;
        const midX = (seg.x1 + seg.x2) / 2;
        const midY = (seg.y1 + seg.y2) / 2;
        const bw = 188, rh = 16, bp = 8, bh = 7 * rh + bp * 2;
        const tx = Math.min(Math.max(midX - bw/2, PAD), size-PAD-bw);
        const ty = midY > size/2 ? midY - bh - 12 : midY + 12;
        return (
          <SvgTooltip x={tx} y={ty} width={bw} rowHeight={rh} rows={[
            ["tick",      `#${tick.index+1}`],
            ["k / r",     tick.kNorm.toFixed(4)],
            ["position",  `${(tick.frac*100).toFixed(0)}%`],
            ["x+y",       f(tick.S)],
            ["arc pt",    tick.pt ? `(${f(tick.pt[0])}, ${f(tick.pt[1])})` : "—"],
            ["liquidity", tick.liquidityGross.toLocaleString()],
            ["type",      tick.isInterior ? "interior" : "boundary"],
          ]} />
        );
      })()}

      {/* Reserve point */}
      <line x1={rpx} y1={rpy} x2={rpx} y2={sy(0)} stroke="#4ade80" strokeWidth={0.7} strokeOpacity={0.22} strokeDasharray="2 4" />
      <line x1={rpx} y1={rpy} x2={sx(0)} y2={rpy} stroke="#4ade80" strokeWidth={0.7} strokeOpacity={0.22} strokeDasharray="2 4" />
      <circle cx={rpx} cy={rpy} r={14} fill="#4ade80" fillOpacity={0.05} />
      <circle cx={rpx} cy={rpy} r={5.5} fill="none" stroke="#4ade80" strokeWidth={1.5} strokeOpacity={0.55} />
      <circle cx={rpx} cy={rpy} r={3} fill="#4ade80" />
      <text x={rpx+(rpx>size/2?-10:10)} y={rpy-10} fontSize={9} fontFamily="monospace"
        fill="#4ade80" fillOpacity={0.85} textAnchor={rpx>size/2?"end":"start"}>
        ({f(rx)}, {f(ry)})
      </text>
    </>
  );
}
