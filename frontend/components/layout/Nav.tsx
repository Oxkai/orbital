"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { color, getThemeCssVariables, typography, type ThemeName } from "@/constants";

export function Nav() {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const applyTheme = useCallback((nextTheme: ThemeName) => {
    const vars = getThemeCssVariables(nextTheme);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    root.dataset.theme = nextTheme;
  }, []);

  useEffect(() => { applyTheme(theme); }, [applyTheme, theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem("theme", next);
  };

  return (
    <nav
      className="sticky top-0 z-40 grid h-14 grid-cols-12 items-center gap-5 px-6 border-b backdrop-blur-md"
      style={{
        borderColor: color.borderSubtle,
        backgroundColor: "color-mix(in srgb, var(--color-bg) 82%, transparent)",
      }}
    >
      <div className="col-span-4 grid items-center">
        <Link href="/" className="inline-grid grid-flow-col auto-cols-max items-center gap-2">
          <div className="w-4 h-4 rounded-full border" style={{ borderColor: color.textPrimary }} />
          <span
            style={{
              fontFamily: typography.p1.family,
              fontSize: "15px",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              color: color.textPrimary,
            }}
          >
            ORBITAL
          </span>
        </Link>
      </div>

      <div className="col-span-8 grid grid-flow-col auto-cols-max items-center justify-self-end gap-3 md:col-start-9 md:col-end-13">
        <button
          onClick={toggleTheme}
          className="grid place-items-center px-2 py-1.5 border transition-colors hover:opacity-90"
          style={{
            borderColor: color.border,
            color: color.textPrimary,
            aspectRatio: "1 / 1",
          }}
          aria-label="Toggle dark and light mode"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark"
            ? <Sun size={16} strokeWidth={1.8} aria-hidden="true" />
            : <Moon size={16} strokeWidth={1.8} aria-hidden="true" />}
        </button>

        <button
          disabled
          style={{
            border: `1px solid ${color.border}`,
            color: color.textMuted,
            fontFamily: typography.p2.family,
            fontSize: typography.p2.size,
            letterSpacing: typography.p2.letterSpacing,
            background: "none",
            cursor: "not-allowed",
            padding: "6px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          Launch App
          <span
            style={{
              fontSize: "9px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#F5AC37",
              border: "1px solid #F5AC3766",
              padding: "1px 5px",
              lineHeight: "14px",
            }}
          >
            Soon
          </span>
        </button>
      </div>
    </nav>
  );
}
