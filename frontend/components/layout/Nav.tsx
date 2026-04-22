"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Grid3X3, Moon, Sun } from "lucide-react";
import {
  color,
  getThemeCssVariables,
  typography,
  type ThemeName,
} from "@/constants";

const LINKS = ["Swap", "Pools", "Positions", "Dashboard", "Analytics"] as const;
const GRID_STORAGE_KEY = "layout-grid-visible";

export function Nav() {
  const [theme, setTheme] = useState<ThemeName>(() => {
    if (typeof window === "undefined") return "dark";
    const saved = window.localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });
  const [showGrid, setShowGrid] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = window.localStorage.getItem(GRID_STORAGE_KEY);
    return saved === null ? false : saved === "true";
  });

  const applyTheme = useCallback((nextTheme: ThemeName) => {
    const vars = getThemeCssVariables(nextTheme);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [applyTheme, theme]);

  useEffect(() => {
    document.documentElement.dataset.layoutGrid = showGrid ? "visible" : "hidden";
  }, [showGrid]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem("theme", nextTheme);
  };

  const toggleGrid = () => {
    const nextValue = !showGrid;
    setShowGrid(nextValue);
    window.localStorage.setItem(GRID_STORAGE_KEY, String(nextValue));
    document.documentElement.dataset.layoutGrid = nextValue ? "visible" : "hidden";
  };

  return (
    <nav
      className="sticky top-0 z-40 flex items-center justify-between h-14 px-6 border-b backdrop-blur-md"
      style={{
        borderColor: color.borderSubtle,
        backgroundColor: "color-mix(in srgb, var(--color-bg) 82%, transparent)",
      }}
    >
      <div className="flex items-center gap-5">
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full border"
            style={{ borderColor: color.textPrimary }}
          />
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

      <div className="hidden md:flex items-center gap-7">
        {LINKS.map((l) => (
          <Link
            key={l}
            href={`/${l.toLowerCase()}`}
            className="transition-colors hover:opacity-100"
            style={{
              fontFamily: typography.p2.family,
              fontSize: typography.p2.size,
              letterSpacing: typography.p2.letterSpacing,
              color: color.textSecondary,
              opacity: 0.75,
            }}
          >
            {l}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-3">
      
        {process.env.NODE_ENV === "development" && (
          <button
            onClick={toggleGrid}
            className="px-2 py-1.5 border transition-colors hover:opacity-90 flex items-center justify-center"
            style={{
              borderColor: color.border,
              color: color.textPrimary,
              fontFamily: typography.p2.family,
              fontSize: typography.p2.size,
              letterSpacing: typography.p2.letterSpacing,
              aspectRatio: "1 / 1",
            }}
            aria-label="Toggle layout grid"
            title={showGrid ? "Hide layout grid" : "Show layout grid"}
          >
            <Grid3X3 size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
        <button
          onClick={toggleTheme}
          className="px-2 py-1.5 border transition-colors hover:opacity-90 flex items-center justify-center"
          style={{
            borderColor: color.border,
            color: color.textPrimary,
            fontFamily: typography.p2.family,
            fontSize: typography.p2.size,
            letterSpacing: typography.p2.letterSpacing,
             aspectRatio: "1 / 1",
            
          }}
          aria-label="Toggle dark and light mode"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun size={16} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <Moon size={16} strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>
        <button
          className="px-4 py-1.5 transition-colors hover:bg-white hover:text-black"
          style={{
            border: `1px solid ${color.textPrimary}`,
            color: color.textPrimary,
            fontFamily: typography.p2.family,
            fontSize: typography.p2.size,
            letterSpacing: typography.p2.letterSpacing,
          }}
        >
          Launch App
        </button>
      </div>
    </nav>
  );
}

