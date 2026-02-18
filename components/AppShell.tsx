"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import BottomNav from "@/components/BottomNav";
import PlanBootstrap from "@/components/PlanBootstrap";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { isAdminUser, logoutLocal } from "@/lib/auth";
import { formatDateLongSpanish, getLocalISODate } from "@/lib/date";

function Header() {
  const router = useRouter();
  const { user } = useAuth();
  const todayLabel = formatDateLongSpanish(getLocalISODate());
  const displayIdentity = (user?.name ?? "").trim() || (user?.email ?? "").trim();
  const title = displayIdentity ? `Hola, ${displayIdentity}` : "Hola";
  const showAdminSettings = isAdminUser(user);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/90 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col items-start gap-1">
          <ThemeToggle />
          <h1 className="text-xl font-bold text-[var(--foreground)]">{title}</h1>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Cerrar sesion"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--muted)]"
              onClick={() => {
                void logoutLocal();
                router.replace("/login");
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
            {showAdminSettings ? (
              <Link
                href="/settings"
                aria-label="Ajustes administrador"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--muted)]"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                  <path d="M11.96 2a1.9 1.9 0 0 1 1.9 1.9v.67c.47.1.92.28 1.34.52l.47-.47a1.9 1.9 0 0 1 2.68 0l1.03 1.03a1.9 1.9 0 0 1 0 2.68l-.47.47c.24.42.42.87.52 1.34h.67a1.9 1.9 0 0 1 1.9 1.9v1.46a1.9 1.9 0 0 1-1.9 1.9h-.67c-.1.47-.28.92-.52 1.34l.47.47a1.9 1.9 0 0 1 0 2.68l-1.03 1.03a1.9 1.9 0 0 1-2.68 0l-.47-.47c-.42.24-.87.42-1.34.52v.67a1.9 1.9 0 0 1-1.9 1.9h-1.46a1.9 1.9 0 0 1-1.9-1.9v-.67a5.9 5.9 0 0 1-1.34-.52l-.47.47a1.9 1.9 0 0 1-2.68 0L4.62 18.3a1.9 1.9 0 0 1 0-2.68l.47-.47a5.9 5.9 0 0 1-.52-1.34H3.9a1.9 1.9 0 0 1-1.9-1.9v-1.46a1.9 1.9 0 0 1 1.9-1.9h.67c.1-.47.28-.92.52-1.34l-.47-.47a1.9 1.9 0 0 1 0-2.68L5.65 4.62a1.9 1.9 0 0 1 2.68 0l.47.47c.42-.24.87-.42 1.34-.52V3.9A1.9 1.9 0 0 1 12.04 2h-.08ZM12 8.1a3.9 3.9 0 1 0 0 7.8 3.9 3.9 0 0 0 0-7.8Z" />
                </svg>
              </Link>
            ) : null}
          </div>
          <p className="rounded-full bg-[var(--surface-soft)] px-2 py-1 text-xs capitalize text-[var(--muted)]">
            {todayLabel}
          </p>
        </div>
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isAdminPanelPage = pathname === "/settings" || pathname === "/import";

  return (
    <AuthGuard>
      {isAuthPage ? (
        <main className="min-h-dvh bg-[var(--background)] px-4 py-[max(1rem,env(safe-area-inset-top))]">{children}</main>
      ) : (
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-transparent">
          <Header />
          <main
            className={[
              "flex-1 px-4 py-4",
              isAdminPanelPage ? "pb-4" : "pb-[calc(6rem+env(safe-area-inset-bottom))]",
            ].join(" ")}
          >
            <PlanBootstrap />
            {children}
          </main>
          {isAdminPanelPage ? null : <BottomNav />}
        </div>
      )}
    </AuthGuard>
  );
}
