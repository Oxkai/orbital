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
];

function MechanicsCard({ card }: { card: typeof CARDS[number] }) {
  return (
    <article
      className="flex flex-col justify-between p-6"
      style={{ backgroundColor: color.surface1, aspectRatio: "1 / 1" }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: "12px",
          letterSpacing: "0.1em",
          color: color.textMuted,
          textTransform: "uppercase",
        }}
      >
        {card.title}
      </span>
      <p
        style={{
          fontFamily: typography.h1.family,
          fontSize: "clamp(22px, 2.8vw, 38px)",
          lineHeight: "1.1",
          letterSpacing: "-0.035em",
          color: color.textPrimary,
          fontWeight: 400,
        }}
      >
        {card.lede}
      </p>
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
        {CARDS.map((card) => (
          <MechanicsCard key={card.n} card={card} />
        ))}
      </div>
    </section>
  );
}
