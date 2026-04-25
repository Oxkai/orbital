import { color, typography } from "@/constants";
import { SectionLabel } from "./SectionLabel";

type MetaRow = { k: string; v: string };

type CardProps = {
  n: string;
  tag: string;
  title: string;
  lede: string;
  body: string;
  meta: MetaRow[];
};

const CARDS: CardProps[] = [
  {
    n: "01",
    tag: "N-SPHERE",
    title: "Sphere",
    lede: "Reserves live on an N-dimensional sphere.",
    body: "The pool tracks a vector x ∈ ℝⁿ constrained to the sphere. The equal-price point sits on the surface; every swap walks along it.",
    meta: [
      { k: "DIM", v: "ℝⁿ" },
      { k: "SURFACE", v: "radius r" },
    ],
  },
  {
    n: "02",
    tag: "HALF-SPACE",
    title: "Ticks",
    lede: "Each LP picks a plane. The plane is the depeg tolerance.",
    body: "Tight ticks give tight pricing and flip fast. Wide ticks back the pool up under depeg stress and only flip at the extremes.",
    meta: [
      { k: "PLANES", v: "per-LP" },
      { k: "STATE", v: "INTERIOR / BOUNDARY" },
    ],
  },
  {
    n: "03",
    tag: "AGGREGATE",
    title: "Torus",
    lede: "Stacked ticks form a torus. slot0 verifies O(1).",
    body: "Five aggregates — sumX, sumXSq, rInt, kBound, sBound — let mint / swap / burn check the invariant in constant time.",
    meta: [
      { k: "SLOT0", v: "5 agg" },
      { k: "COST", v: "O(1)" },
    ],
  },
];

export function Mechanics() {
  return (
    <section
      className="mx-6 my-1"
    >
      <SectionLabel border chapter="III" section="02" path="ORBITAL / MECHANICS" />

      <div className="grid grid-cols-1 pt-20 pb-12">
       
        <h2
          className="text-left"
          style={{
            fontFamily: typography.h1.family,
            fontSize: "clamp(44px, 7vw, 76px)",
            lineHeight: "0.9",
            letterSpacing: "-0.055em",
            fontWeight: 400,
            color: color.textPrimary,
          }}
        >
          Mechanics
        </h2>
      </div>

      <div
        className=" pb-12"
        style={{ borderColor: color.borderSubtle }}
      >
        <p
          style={{
            fontFamily: typography.h2.family,
            fontSize: "clamp(22px, 2.4vw, 32px)",
            lineHeight: "1.35",
            letterSpacing: "-0.025em",
            color: color.textPrimary,
            maxWidth: "58ch",
          }}
        >
          Three ideas do the work.{" "}
          <span style={{ color: color.textMuted }}>
            A sphere for reserves. A plane for every position. A torus that
            holds them together.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-12 gap-5 pb-24">
        {CARDS.map((card) => (
          <article key={card.n} className="col-span-12 flex flex-col gap-4 md:col-span-3">
            <div
              className="flex items-center gap-6"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: color.textMuted,
              }}
            >
              <span>{card.n} /</span>
              <span style={{ color: color.textPrimary }}>{card.title}</span>
            </div>

            <p
              style={{
                fontFamily: typography.h2.family,
                fontSize: "clamp(16px, 1.25vw, 14px)",
                lineHeight: "22px",
                letterSpacing: "0em",
                color: color.textPrimary,
                fontWeight: 400,
                
              }}
            >
              {card.body}
            </p>
          </article>
        ))}
      </div>

    </section>
  );
}
