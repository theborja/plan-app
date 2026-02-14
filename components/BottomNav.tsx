"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/today", label: "Hoy" },
  { href: "/workout", label: "Entreno" },
  { href: "/import", label: "Importar" },
  { href: "/settings", label: "Ajustes" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-zinc-200 bg-white/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur">
      <ul className="grid grid-cols-4 gap-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={[
                  "flex h-11 items-center justify-center rounded-xl text-sm font-medium transition",
                  isActive
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
