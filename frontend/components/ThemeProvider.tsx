"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeCtx);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  function toggle() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="flex items-center gap-2 px-2.5 py-1.5 rounded text-tertiary hover:text-secondary transition-all duration-150"
      style={{ background: "var(--color-surface)" }}
    >
      {isDark ? (
        /* sun icon */
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <circle cx="6.5" cy="6.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M6.5 1v1.2M6.5 10.8V12M1 6.5h1.2M10.8 6.5H12M2.7 2.7l.85.85M9.45 9.45l.85.85M2.7 10.3l.85-.85M9.45 3.55l.85-.85"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
          />
        </svg>
      ) : (
        /* moon icon */
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path
            d="M11 7.5A5 5 0 015.5 2a5 5 0 100 9 5 5 0 005.5-3.5z"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      )}
      <span className="text-[10px] font-mono">{isDark ? "light" : "dark"}</span>
    </button>
  );
}
