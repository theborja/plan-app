"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/today", label: "Hoy", icon: "Home" },
  { href: "/workout", label: "Entreno", icon: "Move" },
  { href: "/import", label: "Importar", icon: "Upload" },
  { href: "/settings", label: "Ajustes", icon: "Tune" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-[var(--border)] bg-[var(--surface)]/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur">
      <ul className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;

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
                <span className="text-[10px] leading-none">{tab.icon}</span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
