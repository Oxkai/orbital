import { color, typography } from "@/constants";
import type { Token } from "@/lib/mock/data";

interface TokenPillProps {
  token: Token;
  size?: "sm" | "md";
}

export function TokenPill({ token, size = "md" }: TokenPillProps) {
  const sm = size === "sm";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        style={{
          width: sm ? 5 : 6,
          height: sm ? 5 : 6,
          borderRadius: "50%",
          backgroundColor: token.color,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: typography.p3.family,
          fontSize: sm ? "11px" : typography.p3.size,
          letterSpacing: "0.02em",
          fontWeight: 500,
          color: color.textSecondary,
        }}
      >
        {token.symbol}
      </span>
    </span>
  );
}
