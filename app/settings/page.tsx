"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import Toast from "@/components/Toast";
import { isAdminUser, logoutLocal } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { fetchJson, postJson } from "@/lib/clientApi";

const DAYS: Array<{ key: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"; label: string }> = [
  { key: "Mon", label: "Lun" },
  { key: "Tue", label: "Mar" },
  { key: "Wed", label: "Mie" },
  { key: "Thu", label: "Jue" },
  { key: "Fri", label: "Vie" },
  { key: "Sat", label: "Sab" },
  { key: "Sun", label: "Dom" },
];

type Settings = {
  nutritionStartDateISO: string;
  trainingDays: Array<(typeof DAYS)[number]["key"]>;
};

type PlanHistoryItem = {
  id: string;
  name: string;
  sourceFileName: string;
  importedAt: string;
  isActive: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, isReady, refresh } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [history, setHistory] = useState<PlanHistoryItem[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);

  const canAccess = user ? isAdminUser(user) : false;

  useEffect(() => {
    if (!isReady || !canAccess) return;
    void (async () => {
      try {
        const [settingsData, historyData] = await Promise.all([
          fetchJson<{ ok: true; settings: Settings }>("/api/settings"),
          fetchJson<{ ok: true; history: PlanHistoryItem[] }>("/api/plans/history"),
        ]);
        setSettings(settingsData.settings);
        setHistory(historyData.history);
      } catch (error) {
        setToast({
          message: error instanceof Error ? error.message : "No se pudieron cargar ajustes.",
          tone: "error",
        });
      }
    })();
  }, [isReady, canAccess]);

  async function saveSettings(next: Settings) {
    try {
      const data = await postJson<{ ok: true; settings: Settings }>("/api/settings", {
        nutritionStartDateISO: next.nutritionStartDateISO,
        trainingDays: next.trainingDays,
      });
      setSettings(data.settings);
      setToast({ message: "Ajustes guardados.", tone: "success" });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "No se pudieron guardar los ajustes.",
        tone: "error",
      });
    }
  }

  function toggleDay(day: (typeof DAYS)[number]["key"]) {
    if (!settings) return;
    const hasDay = settings.trainingDays.includes(day);
    const nextDays = hasDay
      ? settings.trainingDays.filter((item) => item !== day)
      : [...settings.trainingDays, day].sort((a, b) => DAYS.findIndex((d) => d.key === a) - DAYS.findIndex((d) => d.key === b));

    if (nextDays.length === 0) {
      setToast({ message: "Debe haber al menos un dia de entrenamiento.", tone: "info" });
      return;
    }

    void saveSettings({ ...settings, trainingDays: nextDays });
  }

  if (isReady && canAccess === false) {
    return <EmptyState title="Sin acceso" description="Solo el usuario admin puede entrar en Ajustes." />;
  }

  if (!isReady || !settings) {
    return (
      <Card title="Cargando ajustes">
        <Skeleton lines={3} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
        onClick={() => router.push("/")}
      >
        {"<"} Volver
      </button>

      <Card title="Herramientas admin" subtitle="Gestion de plan y datos en BBDD">
        <Link href="/import" className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white">
          Importar y asignar plan Excel
        </Link>
      </Card>

      <Card title="Ciclo nutricional" subtitle="Fecha de inicio del ciclo">
        <input
          type="date"
          value={settings.nutritionStartDateISO}
          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          onChange={(event) => {
            if (!event.target.value) return;
            void saveSettings({ ...settings, nutritionStartDateISO: event.target.value });
          }}
        />
      </Card>

      <Card title="Entrenamiento" subtitle="Dias activos">
        <div className="grid grid-cols-4 gap-2">
          {DAYS.map((day) => {
            const active = settings.trainingDays.includes(day.key);
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => toggleDay(day.key)}
                className={[
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition",
                  active ? "border-emerald-500 bg-emerald-500 text-white" : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]",
                ].join(" ")}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title="Historial de planes">
        {history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin planes importados.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((item) => (
              <li key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm">
                <p className="font-semibold text-[var(--foreground)]">{item.sourceFileName}</p>
                <p className="text-xs text-[var(--muted)]">{new Date(item.importedAt).toLocaleString("es-ES")}</p>
                <p
                  className={[
                    "text-xs font-semibold",
                    item.isActive ? "text-emerald-600" : "text-[var(--muted)]",
                  ].join(" ")}
                >
                  {item.isActive ? "Activo" : "Historico"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Sesion">
        <button
          type="button"
          className="w-full rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white"
          onClick={() => {
            void logoutLocal().then(() => {
              void refresh();
            });
            router.replace("/login");
          }}
        >
          Cerrar sesion
        </button>
      </Card>

      <Toast message={toast?.message ?? null} tone={toast?.tone ?? "info"} onClose={() => setToast(null)} />
    </div>
  );
}
