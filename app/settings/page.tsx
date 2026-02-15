"use client";

import { useEffect, useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import Toast from "@/components/Toast";
import { downloadJson, readJsonFile } from "@/lib/jsonFile";
import {
  STORAGE_KEYS,
  loadPlanV1,
  loadSelectionsV1,
  loadSettingsV1,
  saveSelectionsV1,
  saveSettingsV1,
} from "@/lib/storage";
import type { PlanV1, SelectionsV1, SettingsV1, TrainingDayNumber } from "@/lib/types";
import { isSelectionsV1 } from "@/lib/validate";

const MAP_KEYS = ["Tue", "Wed", "Sat", "Sun"] as const;

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsV1 | null>(null);
  const [plan, setPlan] = useState<PlanV1 | null>(null);
  const [selections, setSelections] = useState<SelectionsV1 | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(
    null,
  );
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSettings(loadSettingsV1());
    setPlan(loadPlanV1());
    setSelections(loadSelectionsV1());
  }, []);

  function updateSettings(next: SettingsV1) {
    setSettings(next);
    saveSettingsV1(next);
  }

  function updateTrainingMapDay(day: (typeof MAP_KEYS)[number], value: TrainingDayNumber) {
    if (!settings) return;
    updateSettings({
      ...settings,
      trainingDayMap: {
        ...settings.trainingDayMap,
        [day]: value,
      },
    });
    setToast({ message: "Ajustes guardados.", tone: "success" });
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
    setShowResetConfirm(false);
    setPlan(null);
    setSelections(null);
    setSettings(null);
    setToast({ message: "Datos locales eliminados. Recarga la app para reiniciar flujo.", tone: "info" });
  }

  if (!settings) {
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

      <Card title="Training day map" subtitle="Relacion entre dia real y DIA 1..4 del plan">
        <div className="space-y-3">
          {MAP_KEYS.map((day) => (
            <label key={day} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-zinc-800">{day}</span>
              <select
                className="rounded-lg border border-zinc-300 px-2 py-1"
                value={settings.trainingDayMap[day]}
                onChange={(event) =>
                  updateTrainingMapDay(day, Number(event.target.value) as TrainingDayNumber)
                }
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={4}>4</option>
              </select>
            </label>
          ))}
        </div>
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
            Borra `plan_v1`, `selections_v1` y `settings_v1` del localStorage.
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
