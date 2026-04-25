import { color, colors, typography } from "@/constants";
import { SectionLabel } from "./SectionLabel";

const COLUMNS = ["Uniswap V3", "Curve Stable", "Balancer", "Orbital"] as const;

type Row = {
  property: string;
  values: [string, string, string, string];
  highlights?: [boolean, boolean, boolean, boolean];
};

const ROWS: Row[] = [
  {
    property: "Assets per pool",
    values: ["2", "2–8 (fixed)", "2–8 (fixed)", "N (≥ 2)"],
    highlights: [false, false, false, true],
  },
  {
    property: "Concentrated liquidity",
    values: ["Yes", "No", "No", "Yes"],
    highlights: [true, false, false, true],
  },
  {
    property: "Per-LP depeg range",
    values: ["n/a", "No", "No", "Yes"],
    highlights: [false, false, false, true],
  },
  {
    property: "Depeg drains pool",
    values: ["n/a", "Yes", "Yes", "Isolated"],
    highlights: [false, false, false, true],
  },
  {
    property: "Capital efficiency at peg",
    values: ["High (pair)", "~1–2× flat", "~1–2× flat", "~154× flat, N=5"],
    highlights: [false, false, false, true],
  },
  {
    property: "TWAP oracle",
    values: ["Yes", "No", "Yes", "Yes"],
    highlights: [true, false, true, true],
  },
  {
    property: "NFT positions",
    values: ["Yes", "No", "No", "Yes"],
    highlights: [true, false, false, true],
  },
];

export function VsTable() {
  return (
    <section className="mx-6 my-1">
      <SectionLabel border chapter="IV" section="03" path="ORBITAL / COMPARISON" />

      <div className="pt-10 pb-14">
        <div className="mb-10">
          <h2
            style={{
              fontFamily: typography.h1.family,
              fontSize: typography.h1.size,
              lineHeight: typography.h1.lineHeight,
              letterSpacing: typography.h1.letterSpacing,
              fontWeight: 400,
              color: color.textPrimary,
            }}
          >
            Versus
          </h2>
        </div>

        <div
          className="grid grid-cols-12 gap-5 border border-dashed"
          style={{ borderColor: color.border }}
        >
          <div
            className="col-span-12 grid grid-cols-12 gap-5 py-3 border-b border-dashed"
            style={{
              borderColor: color.borderSubtle,
              backgroundColor: color.surface1,
            }}
          >
            <div
              className="col-span-3 md:col-start-1 md:col-span-1 pl-2 md:pl-3"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: color.textMuted,
                textTransform: "uppercase",
              }}
            >
              #
            </div>
            <div
              className="col-span-9 md:col-start-2 md:col-span-3"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: color.textMuted,
                textTransform: "uppercase",
              }}
            >
              Property
            </div>
            {COLUMNS.map((c, ci) => (
              <div
                key={c}
                className={`col-span-6 ${
                  ci === 0
                    ? "md:col-start-5 md:col-span-2"
                    : ci === 1
                    ? "md:col-start-7 md:col-span-2"
                    : ci === 2
                    ? "md:col-start-9 md:col-span-2"
                    : "md:col-start-11 md:col-span-2"
                }`}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.06em",
                  color: c === "Orbital" ? colors.purple.hex : color.textSecondary,
                  textTransform: "uppercase",
                }}
              >
                {c}
              </div>
            ))}
          </div>

          <div className="col-span-12">
            {ROWS.map((row, ri) => (
              <div
                key={row.property}
                className="grid grid-cols-12 gap-5 py-3"
                style={{
                  borderBottom:
                    ri < ROWS.length - 1 ? `1px dashed ${color.borderSubtle}` : "none",
                }}
              >
                <div
                  className="col-span-3 md:col-start-1 md:col-span-1 pl-2 md:pl-3"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: color.textMuted,
                    letterSpacing: "0.06em",
                  }}
                >
                  {String(ri + 1).padStart(2, "0")}
                </div>
                <div
                  className="col-span-9 md:col-start-2 md:col-span-3"
                  style={{
                    fontFamily: typography.p2.family,
                    fontSize: typography.p2.size,
                    color: color.textSecondary,
                  }}
                >
                  {row.property}
                </div>

                {row.values.map((v, vi) => (
                  <div
                    key={vi}
                    className={`col-span-6 ${
                      vi === 0
                        ? "md:col-start-5 md:col-span-2"
                        : vi === 1
                        ? "md:col-start-7 md:col-span-2"
                        : vi === 2
                        ? "md:col-start-9 md:col-span-2"
                        : "md:col-start-11 md:col-span-2"
                    }`}
                    style={{
                      fontFamily: vi === 3 ? "var(--font-mono)" : typography.p2.family,
                      fontSize: typography.p2.size,
                      color:
                        vi === 3
                          ? colors.purple.hex
                          : row.highlights?.[vi]
                          ? color.textPrimary
                          : color.textMuted,
                      letterSpacing: vi === 3 ? "0.02em" : typography.p2.letterSpacing,
                    }}
                  >
                    {v}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
