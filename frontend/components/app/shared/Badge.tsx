import { color } from "@/constants";

type Variant = "default" | "success" | "warning" | "error" | "muted" | "accent";

const VARIANTS: Record<Variant, { text: string; border: string; bg: string }> = {
  default: { text: color.textSecondary, border: color.border,         bg: color.surface2    },
  success: { text: color.textSecondary, border: color.border,         bg: "transparent"     },
  warning: { text: color.warning,       border: "#F1DF3830",          bg: "#F1DF380a"       },
  error:   { text: color.error,         border: "#F5686830",          bg: "#F568680a"       },
  muted:   { text: color.textMuted,     border: color.borderSubtle,   bg: "transparent"     },
  accent:  { text: color.accent,        border: `${color.accent}33`,  bg: `${color.accent}0a` },
};

const DOT_COLOR: Record<Variant, string> = {
  default: color.textMuted,
  success: color.success,
  warning: color.warning,
  error:   color.error,
  muted:   color.textMuted,
  accent:  color.accent,
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  dot?: boolean;
}

export function Badge({ children, variant = "default", dot }: BadgeProps) {
  const v = VARIANTS[variant];
  return (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        padding: "2px 8px",
        border: `1px solid ${v.border}`,
        backgroundColor: v.bg,
        color: v.text,
        fontFamily: "var(--font-mono)",
        fontSize: "9px",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        lineHeight: "16px",
      }}
    >
      {dot && (
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: "50%",
            backgroundColor: DOT_COLOR[variant],
            display: "inline-block",
            flexShrink: 0,
            opacity: 0.8,
          }}
        />
      )}
      {children}
    </span>
  );
}
