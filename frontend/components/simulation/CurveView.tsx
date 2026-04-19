import type { Coin, Tick2D } from "@/lib/simulation";

interface CurveGeo {
  PAD:      number;
  DOMAIN:   number;
  sx:       (v: number) => number;
  sy:       (v: number) => number;
  q:        number;
  rx:       number;
  ry:       number;
  rho:      number;
  arcPath:  string;
  width:    number;
  height:   number;
  arcR:     number;
  ticks2D:  Tick2D[];
}

interface Props {
  geo:         CurveGeo;
  coinA:       Coin;
  coinB:       Coin;
  hoveredTick: number | null;
  onHover:     (i: number | null) => void;
}

export default function CurveView({ geo, coinA, coinB, hoveredTick, onHover }: Props) {
  const { sx, sy, q, rx, ry, arcPath, arcR, ticks2D } = geo;
  const rpx = sx(rx), rpy = sy(ry);
  const f = (v: number) => v >= 1e6 ? `${(v/1e6).toFixed(2)}M` : v >= 1e3 ? `${(v/1e3).toFixed(1)}k` : v.toFixed(2);

  return (
    <>
      {/* ── Axes ── */}
      <line x1={sx(0)} y1={sy(0)} x2={sx(arcR * 2.1)} y2={sy(0)}
        stroke="var(--color-border-strong)" strokeWidth={1.2} />
      <line x1={sx(0)} y1={sy(arcR * 2.1)} x2={sx(0)} y2={sy(0)}
        stroke="var(--color-border-strong)" strokeWidth={1.2} />
      {/* arrowheads */}
      <polygon
        points={`${sx(arcR*2.1)},${sy(0)} ${sx(arcR*2.1)-8},${sy(0)-4} ${sx(arcR*2.1)-8},${sy(0)+4}`}
        fill="var(--color-border-strong)" />
      <polygon
        points={`${sx(0)},${sy(arcR*2.1)} ${sx(0)-4},${sy(arcR*2.1)+8} ${sx(0)+4},${sy(arcR*2.1)+8}`}
        fill="var(--color-border-strong)" />
      {/* axis coin labels */}
      <text x={sx(arcR*2.1) - 6} y={sy(0) - 9} fontSize={12} fontFamily="monospace"
        fill="var(--color-secondary)" textAnchor="end">{coinA}</text>
      <text x={sx(0) + 8} y={sy(arcR*2.1) + 14} fontSize={12} fontFamily="monospace"
        fill="var(--color-secondary)">{coinB}</text>

      {/* ── Sphere center marker (r, r) ── */}
      <line x1={sx(0)} y1={sy(arcR)} x2={sx(arcR)} y2={sy(arcR)}
        stroke="var(--color-border-strong)" strokeWidth={0.6} strokeDasharray="3 5" opacity={0.35} />
      <line x1={sx(arcR)} y1={sy(0)} x2={sx(arcR)} y2={sy(arcR)}
        stroke="var(--color-border-strong)" strokeWidth={0.6} strokeDasharray="3 5" opacity={0.35} />
      <circle cx={sx(arcR)} cy={sy(arcR)} r={3}
        fill="var(--color-surface)" stroke="var(--color-tertiary)" strokeWidth={1.2} opacity={0.6} />
      <text x={sx(arcR) + 6} y={sy(arcR) - 6} fontSize={8} fontFamily="monospace"
        fill="var(--color-tertiary)" opacity={0.5}>(r, r)</text>

      {/* ── Hypersphere cross-section: (xA−r)²+(xB−r)²=ρ² ── */}
      <path d={arcPath} fill="var(--color-primary)" opacity={0.05} />
      <path d={arcPath} fill="none"
        stroke="var(--color-primary)" strokeWidth={8} opacity={0.08} />
      <path d={arcPath} fill="none"
        stroke="var(--color-primary)" strokeWidth={2} opacity={0.9} />

      {/* ── Tick plane chords ── */}
      {ticks2D.map(tick => {
        if (!tick.chord) return null;
        const [[x1, y1], [x2, y2]] = tick.chord;
        const color = tick.isInterior ? "var(--color-primary)" : "#f59e0b";
        return (
          <g key={tick.index}>
            {/* chord line */}
            <line
              x1={sx(x1)} y1={sy(y1)} x2={sx(x2)} y2={sy(y2)}
              stroke={color} strokeWidth={1} strokeDasharray="4 3"
              opacity={hoveredTick === tick.index ? 0.85 : 0.35}
            />
            {/* both intersection dots */}
            {[[x1,y1],[x2,y2]].map(([px,py], j) => (
              <circle key={j} cx={sx(px)} cy={sy(py)} r={hoveredTick === tick.index ? 4 : 3}
                fill="var(--color-surface)" stroke={color}
                strokeWidth={1.5} opacity={hoveredTick === tick.index ? 1 : 0.6} />
            ))}
            {/* invisible hit area */}
            <line
              x1={sx(x1)} y1={sy(y1)} x2={sx(x2)} y2={sy(y2)}
              stroke="transparent" strokeWidth={14} style={{ cursor: "default" }}
              onMouseEnter={() => onHover(tick.index)}
              onMouseLeave={() => onHover(null)}
            />
          </g>
        );
      })}

      {/* ── Equal-price point (q, q) ── */}
      <line x1={sx(0)} y1={sy(q)} x2={sx(q)} y2={sy(q)}
        stroke="var(--color-secondary)" strokeWidth={0.7} strokeDasharray="3 4" opacity={0.35} />
      <line x1={sx(q)} y1={sy(0)} x2={sx(q)} y2={sy(q)}
        stroke="var(--color-secondary)" strokeWidth={0.7} strokeDasharray="3 4" opacity={0.35} />
      <circle cx={sx(q)} cy={sy(q)} r={10} fill="none"
        stroke="var(--color-secondary)" strokeWidth={1} opacity={0.2} />
      <circle cx={sx(q)} cy={sy(q)} r={5}
        fill="var(--color-surface)" stroke="var(--color-secondary)" strokeWidth={1.5} opacity={0.85} />
      <circle cx={sx(q)} cy={sy(q)} r={2} fill="var(--color-secondary)" opacity={0.85} />
      <text x={sx(q) + 9} y={sy(q) - 8} fontSize={9} fontFamily="monospace"
        fill="var(--color-secondary)" opacity={0.75}>
        q = {f(q)}
      </text>

      {/* ── Reserve dot ── */}
      <line x1={rpx} y1={sy(0)} x2={rpx} y2={rpy}
        stroke="#34d399" strokeWidth={0.7} strokeDasharray="2 4" opacity={0.35} />
      <line x1={sx(0)} y1={rpy} x2={rpx} y2={rpy}
        stroke="#34d399" strokeWidth={0.7} strokeDasharray="2 4" opacity={0.35} />
      <circle cx={rpx} cy={rpy} r={12} fill="#34d399" opacity={0.08} />
      <circle cx={rpx} cy={rpy} r={6}
        fill="var(--color-surface)" stroke="#34d399" strokeWidth={2} />
      <circle cx={rpx} cy={rpy} r={2.5} fill="#34d399" />
      <text x={rpx + 11} y={rpy - 10} fontSize={9} fontFamily="monospace"
        fill="#34d399" opacity={0.9}>
        ({f(rx)}, {f(ry)})
      </text>
    </>
  );
}
