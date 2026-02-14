import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import PlanBootstrap from "@/components/PlanBootstrap";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plan App",
  description: "Seguimiento de entrenamiento y nutricion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const todayLabel = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white">
          <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-zinc-500">
              Plan App
            </p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <h1 className="text-xl font-semibold text-zinc-900">Mi Plan</h1>
              <p className="text-sm capitalize text-zinc-600">{todayLabel}</p>
            </div>
          </header>

          <main className="flex-1 px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
            <PlanBootstrap />
            {children}
          </main>

          <BottomNav />
        </div>
      </body>
    </html>
  );
}
