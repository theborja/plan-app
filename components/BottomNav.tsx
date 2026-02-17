"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { isAdminUser } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

const tabs = [
  { href: "/today", label: "Hoy", icon: "home" },
  { href: "/workout", label: "Entreno", icon: "dumbbell" },
  { href: "/progress", label: "Progreso", icon: "chart" },
  { href: "/import", label: "Importar", icon: "file" },
  { href: "/settings", label: "Ajustes", icon: "settings" },
];

function Icon({ name }: { name: string }) {
  const common = "h-4 w-4";
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}>
        <path d="M3 10.5L12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    );
  }
  if (name === "dumbbell") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}>
        <path d="M3 9v6M6 7v10M18 7v10M21 9v6" />
        <path d="M6 12h12" />
      </svg>
    );
  }
  if (name === "file") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v6h6" />
      </svg>
    );
  }
  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20v-12" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={common}>
      <path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleTabs = useMemo(() => {
    if (user && isAdminUser(user.email)) {
      return tabs;
    }
    return tabs.filter((tab) => tab.href !== "/import" && tab.href !== "/settings");
  }, [user]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-[var(--border)] bg-[var(--surface)]/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur">
      <ul className="grid gap-1" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
        {visibleTabs.map((tab) => {
          const isActive =
            tab.href === "/progress"
              ? pathname === "/progress" || pathname.startsWith("/progress/")
              : pathname === tab.href;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={[
                  "flex h-12 flex-col items-center justify-center rounded-[var(--radius-pill)] text-[11px] font-semibold uppercase tracking-wide transition",
                  isActive
                    ? "bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] text-white shadow-md"
                    : "bg-[var(--surface-soft)] text-[var(--muted)] hover:bg-white",
                ].join(" ")}
              >
                <span className="mb-0.5 leading-none">
                  <Icon name={tab.icon} />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
