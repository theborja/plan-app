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
            {showAdminSettings ? (
              <Link
                href="/settings"
                aria-label="Ajustes administrador"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-soft)] text-[var(--muted)]"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1L7 17M17 7l2.1-2.1" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </Link>
            ) : null}
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
