import type { ReactNode } from "react";
import { color, typography } from "@/constants";

type Props = {
  index: string;
  sectionPath: string;
  title: string;
  children: ReactNode;
  dense?: boolean;
};

export function SectionFrame({
  index,
  sectionPath,
  title,
  children,
  dense = false,
}: Props) {
  return (
    <section
      className="border-t mx-6 py-1"
      style={{ borderColor: color.border }}
    >
      <div
        className="grid grid-cols-12 items-center py-2 gap-5"
        style={{
          borderColor: color.borderSubtle,
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.06em",
          color: color.textMuted,
          textTransform: "uppercase",
        }}
      >
        <span className="col-span-12 md:col-span-2">// VI / {index}</span>
        <span className="col-span-12 md:col-span-10">// {sectionPath}</span>
      </div>

      <div className="pt-10 pb-14">
        <div className="flex items-start justify-between mb-10">
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
            {title}
          </h2>
          <span
            style={{
              fontFamily: typography.h1.family,
              fontSize: typography.h1.size,
              lineHeight: typography.h1.lineHeight,
              letterSpacing: typography.h1.letterSpacing,
              fontWeight: 400,
              color: color.textMuted,
            }}
          >
            {index}
          </span>
        </div>
        <div className={dense ? "" : "mt-4"}>{children}</div>
      </div>
    </section>
  );
}

export function SubLabel({ index, name }: { index: string; name: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        letterSpacing: "0.08em",
        color: color.textMuted,
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {index} / {name}
    </div>
  );
}
