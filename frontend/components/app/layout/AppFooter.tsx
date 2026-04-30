import { color } from "@/constants";

export function AppFooter() {
  return (
    <footer
      className="shrink-0 flex items-center h-10 justify-between m-4 px-6"
      style={{
        backgroundColor: color.surface1,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.06em",
          color: color.textMuted,
        }}
      >
        BASE SEPOLIA · CHAIN ID 84532
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          letterSpacing: "0.06em",
          color: color.textMuted,
        }}
      >
        © 2026 ORBITAL
      </span>
    </footer>
  );
}
