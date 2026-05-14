import { color, typography } from "@/constants";
import { SectionLabel } from "./SectionLabel";

const MONO = "var(--font-mono)";

const CARDS = [
  {
    n: "01",
    title: "Sphere",
    lede: "Reserves live on an N-dimensional sphere.",
  },
  {
    n: "02",
    title: "Ticks",
    lede: "Each LP picks a plane. The plane is the depeg tolerance.",
  },
  {
    n: "03",
    title: "Torus",
    lede: "Stacked ticks form a torus. slot0 verifies O(1).",
  },
] as const;

function SphereDiagram() {
  const cx = 100;
  const cy = 100;
  const R = 64;
  const tilt = 0.34;
  const latitudes = [-0.7, -0.38, 0, 0.38, 0.7];
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <circle cx={cx} cy={cy} r={R} />
        {latitudes.map((t) => {
          const y = R * t;
          const rx = R * Math.sqrt(1 - t * t);
          return <ellipse key={t} cx={cx} cy={cy + y} rx={rx} ry={rx * tilt} />;
        })}
        <line x1={cx} y1={cy - R} x2={cx} y2={cy + R} strokeDasharray="2 3" strokeOpacity="0.4" />
      </g>
    </svg>
  );
}

function TickDiagram() {
  const cx = 100;
  const cy = 100;
  const R = 64;
  const tilt = 0.34;
  const planeY = -0.32;
  const planeRx = R * Math.sqrt(1 - planeY * planeY);
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        <circle cx={cx} cy={cy} r={R} strokeOpacity="0.55" />
        <ellipse cx={cx} cy={cy} rx={R} ry={R * tilt} strokeOpacity="0.4" strokeDasharray="2 3" />
      </g>
      <g stroke="var(--color-accent)" strokeWidth="1.4" strokeLinecap="round">
        <ellipse cx={cx} cy={cy + R * planeY} rx={planeRx} ry={planeRx * tilt} />
        <line x1={cx - planeRx - 14} y1={cy + R * planeY} x2={cx - planeRx} y2={cy + R * planeY} />
        <line x1={cx + planeRx} y1={cy + R * planeY} x2={cx + planeRx + 14} y2={cy + R * planeY} />
      </g>
    </svg>
  );
}

function TorusDiagram() {
  const cx = 100;
  const cy = 100;
  const Rmajor = 50;
  const Rminor = 18;
  const tilt = 0.4;
  return (
    <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
      <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
        {/* Outer body silhouette */}
        <ellipse cx={cx} cy={cy} rx={Rmajor + Rminor} ry={(Rmajor + Rminor) * tilt} />
        {/* Hole */}
        <ellipse cx={cx} cy={cy} rx={Rmajor - Rminor} ry={(Rmajor - Rminor) * tilt} />
        {/* Two cross-section circles on left/right showing tube */}
        <ellipse cx={cx - Rmajor} cy={cy} rx={Rminor * 0.5} ry={Rminor} />
        <ellipse cx={cx + Rmajor} cy={cy} rx={Rminor * 0.5} ry={Rminor} />
      </g>
    </svg>
  );
}

const DIAGRAMS = [SphereDiagram, TickDiagram, TorusDiagram] as const;

function MechanicsCard({ card, index }: { card: typeof CARDS[number]; index: 0 | 1 | 2 }) {
  const Diagram = DIAGRAMS[index];
  return (
    <article
      className="flex flex-col"
      style={{ backgroundColor: color.surface1, aspectRatio: "1 / 1" }}
    >
      <div className="relative flex-1 min-h-0 grid place-items-center p-6" style={{ color: color.textPrimary }}>
        <Diagram />
      </div>
      <div
        className="flex items-baseline justify-between gap-4 px-6 py-4 border-t border-dashed"
        style={{ borderColor: color.borderSubtle }}
      >
        <span
          style={{
            fontFamily: MONO,
            fontSize: "11px",
            letterSpacing: "0.1em",
            color: color.textMuted,
            textTransform: "uppercase",
          }}
        >
          {`// ${card.n} / ${card.title.toUpperCase()}`}
        </span>
      </div>
      <div className="px-6 pb-6">
        <p
          style={{
            fontFamily: typography.h1.family,
            fontSize: "clamp(20px, 2.4vw, 30px)",
            lineHeight: "1.15",
            letterSpacing: "-0.03em",
            color: color.textPrimary,
            fontWeight: 400,
          }}
        >
          {card.lede}
        </p>
      </div>
    </article>
  );
}

export function Mechanics() {
  return (
    <section className="mx-6 my-1">
      <SectionLabel border chapter="III" section="02" path="ORBITAL / MECHANICS" />

      <div className="pb-12 pt-20">
        <p
          style={{
            fontFamily: typography.h1.family,
            fontSize: "clamp(40px, 5vw, 72px)",
            lineHeight: "1.05",
            letterSpacing: "-0.04em",
            color: color.textPrimary,
            fontWeight: 400,
          }}
        >
          Three ideas do the work.{" "}
          <span style={{ color: color.textMuted }}>
            A sphere for reserves. A plane for every position. A torus that holds them together.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-1 md:grid-cols-3 mb-24">
        {CARDS.map((card, i) => (
          <MechanicsCard key={card.n} card={card} index={i as 0 | 1 | 2} />
        ))}
      </div>
    </section>
  );
}
