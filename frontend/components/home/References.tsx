import { color, typography } from "@/constants";
import { SectionFrame } from "./SectionFrame";

const REFS = [
  {
    n: "01",
    authors: "Paradigm",
    title: "Orbital — An N-dimensional concentrated-liquidity AMM",
    year: "2025",
    href: "https://www.paradigm.xyz/2025/06/orbital",
  },
  {
    n: "02",
    authors: "Adams, Zinsmeister, Salem, Keefer, Robinson",
    title: "Uniswap v3 Core",
    year: "2021",
    href: "https://uniswap.org/whitepaper-v3.pdf",
  },
  {
    n: "03",
    authors: "Egorov",
    title: "StableSwap — efficient mechanism for stablecoin liquidity",
    year: "2019",
    href: "https://resources.curve.finance/pdf/stableswap-paper.pdf",
  },
  {
    n: "04",
    authors: "Orbital contracts",
    title: "contracts/README.md — build, test, deploy, integration",
    year: "this repo",
    href: "https://github.com/",
  },
] as const;

export function References() {
  return (
    <SectionFrame index="06" sectionPath="FOUNDATION / REFERENCES" title="References">
      <ol className="grid grid-cols-12 gap-5">
        {REFS.map((r, i) => (
          <li
            key={r.n}
            className="col-span-12 grid grid-cols-12 items-baseline gap-5 py-4"
            style={{
              borderTop: i === 0 ? "none" : `1px dashed ${color.borderSubtle}`,
            }}
          >
            <span
              className="col-span-2 md:col-span-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: color.textMuted,
                letterSpacing: "0.06em",
              }}
            >
              [{r.n}]
            </span>
            <span
              className="col-span-10 md:col-span-3"
              style={{
                fontFamily: typography.p2.family,
                fontSize: typography.p2.size,
                color: color.textMuted,
              }}
            >
              {r.authors}
            </span>
            <a
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="col-span-12 md:col-span-6"
              style={{
                fontFamily: typography.p1.family,
                fontSize: typography.p1.size,
                color: color.textPrimary,
                letterSpacing: typography.p1.letterSpacing,
              }}
            >
              {r.title}
              <span style={{ color: color.textMuted, marginLeft: 8 }}>↗</span>
            </a>
            <span
              className="col-span-12 md:col-span-2 md:justify-self-end"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: color.textMuted,
                letterSpacing: "0.04em",
              }}
            >
              {r.year}
            </span>
          </li>
        ))}
      </ol>
    </SectionFrame>
  );
}
