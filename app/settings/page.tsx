"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import BottomSheet from "@/components/BottomSheet";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import Toast from "@/components/Toast";
import { isAdminUser, logoutLocal } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { downloadJson, readJsonFile } from "@/lib/jsonFile";
import { resolveTrainingDay } from "@/lib/planResolver";
import {
  STORAGE_KEYS,
  loadPlanV1,
  loadSelectionsV1,
  loadSettingsV1,
  saveSelectionsV1,
  saveSettingsV1,
} from "@/lib/storage";
import type { PlanV1, SelectionsV1, SettingsV1 } from "@/lib/types";
import { isSelectionsV1 } from "@/lib/validate";

const DAYS: Array<{ key: "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun"; label: string }> = [
  { key: "Mon", label: "Lun" },
  { key: "Tue", label: "Mar" },
  { key: "Wed", label: "Mie" },
  { key: "Thu", label: "Jue" },
  { key: "Fri", label: "Vie" },
  { key: "Sat", label: "Sab" },
  { key: "Sun", label: "Dom" },
];
const DAY_LABEL_BY_KEY: Record<(typeof DAYS)[number]["key"], string> = DAYS.reduce(
  (acc, day) => ({ ...acc, [day.key]: day.label }),
  {} as Record<(typeof DAYS)[number]["key"], string>,
);

const DAY_ORDER = DAYS.map((day) => day.key);
const WEEKDAY_PATTERNS: Record<number, Array<(typeof DAYS)[number]["key"]>> = {
  1: ["Mon"],
  2: ["Mon", "Thu"],
  3: ["Mon", "Wed", "Fri"],
  4: ["Mon", "Tue", "Thu", "Fri"],
  5: ["Mon", "Tue", "Thu", "Fri", "Sat"],
  6: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  7: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseDayFromLabel(label: string): (typeof DAYS)[number]["key"] | null {
  const token = normalizeToken(label);
  if (!token) return null;
  if (token.includes("LUNES") || token.includes("MONDAY")) return "Mon";
  if (token.includes("MARTES") || token.includes("TUESDAY")) return "Tue";
  if (token.includes("MIERCOLES") || token.includes("WEDNESDAY")) return "Wed";
  if (token.includes("JUEVES") || token.includes("THURSDAY")) return "Thu";
  if (token.includes("VIERNES") || token.includes("FRIDAY")) return "Fri";
  if (token.includes("SABADO") || token.includes("SATURDAY")) return "Sat";
  if (token.includes("DOMINGO") || token.includes("SUNDAY")) return "Sun";
  return null;
}

function getRoutineDayCount(plan: PlanV1 | null, fallback: number): number {
  const planCount = plan?.training.days.length ?? 0;
  const base = planCount > 0 ? planCount : fallback;
  return Math.max(1, Math.min(7, base));
}

function inferDaysFromPlan(plan: PlanV1 | null, requiredCount: number): Array<(typeof DAYS)[number]["key"]> {
  if (!plan || plan.training.days.length === 0) {
    return [...(WEEKDAY_PATTERNS[requiredCount] ?? DAY_ORDER.slice(0, requiredCount))];
  }

  const fromLabels = plan.training.days
    .map((day) => parseDayFromLabel(day.label))
    .filter((value): value is (typeof DAYS)[number]["key"] => value !== null);

  const uniqueByLabel = [...new Set(fromLabels)].sort(
    (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
  );

  if (uniqueByLabel.length >= requiredCount) {
    return uniqueByLabel.slice(0, requiredCount);
  }

  const merged = [...uniqueByLabel];
  for (const day of WEEKDAY_PATTERNS[requiredCount] ?? DAY_ORDER.slice(0, requiredCount)) {
    if (!merged.includes(day)) {
      merged.push(day);
    }
    if (merged.length === requiredCount) break;
  }
  return merged;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, isReady, refresh } = useAuth();
  const [settings, setSettings] = useState<SettingsV1 | null>(null);
  const [plan, setPlan] = useState<PlanV1 | null>(null);
  const [selections, setSelections] = useState<SelectionsV1 | null>(null);
  const [pendingTrainingDays, setPendingTrainingDays] = useState<Array<(typeof DAYS)[number]["key"]>>([]);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(
    null,
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canAccess = user ? isAdminUser(user) : false;

  useEffect(() => {
    if (!isReady) return;
    const loadedSettings = loadSettingsV1();
    const loadedPlan = loadPlanV1();
    const requiredCount = getRoutineDayCount(loadedPlan, loadedSettings.trainingDays.length || 4);
    const defaultDays = inferDaysFromPlan(loadedPlan, requiredCount);
    const normalizedSaved =
      loadedSettings.trainingDays.length === requiredCount
        ? loadedSettings.trainingDays
        : defaultDays;

    const normalizedSettings: SettingsV1 = {
      ...loadedSettings,
      trainingDays: normalizedSaved,
    };

    if (
      loadedSettings.trainingDays.length !== normalizedSaved.length ||
      loadedSettings.trainingDays.some((day, idx) => normalizedSaved[idx] !== day)
    ) {
      saveSettingsV1(normalizedSettings);
    }

    setSettings(normalizedSettings);
    setPlan(loadedPlan);
    setSelections(loadSelectionsV1());
    setPendingTrainingDays(normalizedSaved);
  }, [isReady]);

  function updateSettings(next: SettingsV1) {
    setSettings(next);
    saveSettingsV1(next);
  }

  function toggleTrainingDay(day: (typeof DAYS)[number]["key"]) {
    if (!settings) return;
    const requiredCount = getRoutineDayCount(plan, settings.trainingDays.length || 4);
    const exists = pendingTrainingDays.includes(day);

    if (!exists && pendingTrainingDays.length >= requiredCount) {
      setToast({
        message: `Tu rutina tiene ${requiredCount} dias. No puedes seleccionar mas.`,
        tone: "info",
      });
      return;
    }

    const nextTrainingDays = exists
      ? pendingTrainingDays.filter((value) => value !== day)
      : [...pendingTrainingDays, day].sort(
          (a, b) => DAYS.findIndex((d) => d.key === a) - DAYS.findIndex((d) => d.key === b),
        );
    setPendingTrainingDays(nextTrainingDays);

    if (nextTrainingDays.length === requiredCount) {
      updateSettings({
        ...settings,
        trainingDays: nextTrainingDays,
      });
      setToast({ message: "Dias de entrenamiento actualizados.", tone: "success" });
      return;
    }

    setToast({
      message: `Selecciona ${requiredCount} dias para guardar cambios.`,
      tone: "info",
    });
  }

  async function handleImportSelections(file: File | null) {
    if (!file) return;

    try {
      const parsed = await readJsonFile(file);
      if (!isSelectionsV1(parsed)) {
        throw new Error("Formato invalido de selections_v1.");
      }
      saveSelectionsV1(parsed);
      setSelections(parsed);
      setToast({ message: "Selections importado correctamente.", tone: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setToast({ message: `Error importando selections: ${message}`, tone: "error" });
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleReset() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(STORAGE_KEYS.plan);
    window.localStorage.removeItem(STORAGE_KEYS.selections);
    window.localStorage.removeItem(STORAGE_KEYS.settings);
    window.localStorage.removeItem(STORAGE_KEYS.measures);
    setShowResetConfirm(false);
    setPlan(null);
    setSelections(null);
    setSettings(null);
    setToast({ message: "Datos locales eliminados. Recarga la app para reiniciar flujo.", tone: "info" });
  }

  function exportWorkoutHistory() {
    if (!selections || !plan || !settings) return;

    const detailedHistory = Object.entries(selections.byDate)
      .filter(([, dayData]) => !!dayData.workout)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([isoDate, dayData]) => {
        const workout = dayData.workout;
        if (!workout) return null;

        const resolvedDay = resolveTrainingDay(plan, isoDate, settings);
        const trainingLabel = resolvedDay?.label ?? "No asignado";

        const exercises = (resolvedDay?.exercises ?? []).map((exercise, index) => {
          const rawSeries = workout.lastWeightByExerciseIndex?.[String(index)] ?? "";
          const parsedWeights = rawSeries.split("||").map((item) => item.trim());
          const inferredSeries = parsedWeights.length > 0 ? parsedWeights.length : 1;
          const seriesCount = Math.max(1, exercise.series ?? inferredSeries);
          const seriesWeights = Array.from({ length: seriesCount }, (_, seriesIndex) => {
            const value = parsedWeights[seriesIndex] ?? "";
            return {
              set: seriesIndex + 1,
              weight: value,
            };
          });

          return {
            exerciseIndex: index,
            exerciseName: exercise.name,
            series: exercise.series ?? null,
            reps: exercise.reps ?? null,
            done: workout.doneExerciseIndexes.includes(index),
            seriesWeights,
          };
        });

        return {
          isoDate,
          trainingType: trainingLabel,
          note: workout.note ?? "",
          updatedAtISO: workout.updatedAtISO ?? null,
          exercises,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    downloadJson("workout-history.json", {
      version: 1,
      exportedAtISO: new Date().toISOString(),
      entries: detailedHistory,
    });
  }

  if (isReady && canAccess === false) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Solo el usuario admin puede entrar en Ajustes."
      />
    );
  }

  if (!isReady || !settings) {
    return (
      <div className="space-y-4">
        <Card title="Cargando ajustes">
          <Skeleton lines={3} />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Ciclo nutricional" subtitle="Define desde que fecha empieza el ciclo de 2 semanas">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-900" htmlFor="start-date">
            Fecha inicio (nutritionStartDateISO)
          </label>
          <input
            id="start-date"
            type="date"
            value={settings.nutritionStartDateISO}
            className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            onChange={(event) => {
              if (!event.target.value) return;
              updateSettings({
                ...settings,
                nutritionStartDateISO: event.target.value,
              });
              setToast({ message: "Ajustes guardados.", tone: "success" });
            }}
          />
        </div>
      </Card>

      <Card title="Entrenamiento" subtitle="Elige que dias entrenas y cuales descansas">
        <div className="grid grid-cols-4 gap-2">
          {DAYS.map((day) => {
            const requiredCount = getRoutineDayCount(plan, settings.trainingDays.length || 4);
            const active = pendingTrainingDays.includes(day.key);
            const atLimit = pendingTrainingDays.length >= requiredCount;
            const disabled = !active && atLimit;
            return (
              <button
                key={day.key}
                type="button"
                onClick={() => toggleTrainingDay(day.key)}
                disabled={disabled}
                className={[
                  "rounded-xl border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                  active
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]",
                ].join(" ")}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">
          Dias activos:{" "}
          {pendingTrainingDays.length === 0
            ? "ninguno"
            : pendingTrainingDays.map((day) => DAY_LABEL_BY_KEY[day]).join(", ")}
        </p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Debes mantener {getRoutineDayCount(plan, settings.trainingDays.length || 4)} dias activos.
        </p>
      </Card>

      <Card title="Importar / Exportar" subtitle="Respalda o restaura datos locales en JSON">
        <div className="space-y-2">
          <button
            type="button"
            className="w-full rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            disabled={!plan}
            onClick={() => plan && downloadJson("plan.json", plan)}
          >
            Exportar plan.json
          </button>

          <button
            type="button"
            className="w-full rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            disabled={!selections}
            onClick={() => selections && downloadJson("selections.json", selections)}
          >
            Exportar selections.json
          </button>

          <button
            type="button"
            className="w-full rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            disabled={!selections}
            onClick={exportWorkoutHistory}
          >
            Exportar workout-history.json
          </button>

          <label className="block">
            <span className="mb-1 block text-sm text-zinc-700">Importar selections.json</span>
            <input
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              className="block w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm"
              onChange={(event) => void handleImportSelections(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </Card>

      <Card title="Reset">
        <div className="space-y-2">
          <p className="text-sm text-zinc-600">
            Borra `plan_v1`, `selections_v1`, `settings_v1` y `measures_v1` del localStorage.
          </p>
          <button
            type="button"
            className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white"
            onClick={() => setShowResetConfirm(true)}
          >
            Reset local
          </button>
        </div>
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

      <BottomSheet
        open={showResetConfirm}
        title="Confirmar reset"
        onClose={() => setShowResetConfirm(false)}
      >
        <div className="space-y-3">
          <p className="text-sm text-zinc-700">
            Se eliminaran todos los datos locales de la app. Esta accion no se puede deshacer.
          </p>
          <button
            type="button"
            className="w-full rounded-xl bg-rose-600 px-3 py-2 text-sm font-medium text-white"
            onClick={handleReset}
          >
            Confirmar borrado
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
