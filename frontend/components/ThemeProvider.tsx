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
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
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
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-150 hover:opacity-80 active:scale-95"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        color: "var(--color-tertiary)",
      }}
    >
      {isDark ? (
        /* sun */
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="2.8" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M7 1.5v1.2M7 11.3v1.2M1.5 7h1.2M11.3 7h1.2M3.2 3.2l.85.85M9.95 9.95l.85.85M3.2 10.8l.85-.85M9.95 4.05l.85-.85"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
          />
        </svg>
      ) : (
        /* moon */
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M11.5 8A5 5 0 016 2.5a5 5 0 100 9 5 5 0 005.5-3.5z"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
