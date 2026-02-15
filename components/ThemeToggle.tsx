"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "theme_mode";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY);
    const initial = saved === "dark" ? "dark" : "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    window.localStorage.setItem(THEME_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Cambiar modo de color"
      className="h-8 w-8 rounded-full bg-[var(--surface-soft)] text-sm text-[var(--muted)]"
    >
      {theme === "light" ? "◐" : "○"}
    </button>
  );
}
