"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import Toast from "@/components/Toast";
import { isAdminUser } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { parseWorkbookToPlanV1, type ParseWorkbookDebug } from "@/lib/parsers/parseWorkbookPlan";
import { defaultSelectionsV1, savePlanV1, saveSelectionsV1 } from "@/lib/storage";
import type { MealType, PlanV1 } from "@/lib/types";

const MEAL_TYPES: MealType[] = [
  "DESAYUNO",
  "ALMUERZO",
  "COMIDA",
  "MERIENDA",
  "CENA",
  "POSTRE",
];

export default function ImportPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const [parsedPlan, setParsedPlan] = useState<PlanV1 | null>(null);
  const [debugInfo, setDebugInfo] = useState<ParseWorkbookDebug | null>(null);
  const [sourceName, setSourceName] = useState<string>("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(
    null,
  );
  const [isBusy, setIsBusy] = useState(false);

  const nutritionRows = useMemo(() => {
    if (!parsedPlan) return [];
    return parsedPlan.nutrition.days.map((day) => ({
      key: `W${day.weekIndex}-${day.dayOfWeek}`,
      weekIndex: day.weekIndex,
      dayOfWeek: day.dayOfWeek,
      counts: MEAL_TYPES.map((mealType) => ({
        mealType,
        count: day.meals[mealType]?.length ?? 0,
      })),
    }));
  }, [parsedPlan]);

  const canAccess = user ? isAdminUser(user) : false;

  async function handleFileChange(file: File | null) {
    if (!file) return;

    setIsBusy(true);
    setToast({ message: "Parseando archivo...", tone: "info" });

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const debug: ParseWorkbookDebug = {};
      const plan = parseWorkbookToPlanV1(workbook, file.name, debug);

      setParsedPlan(plan);
      setDebugInfo(debug);
      setSourceName(file.name);
      setToast({ message: "Archivo parseado correctamente.", tone: "success" });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Error desconocido";
      setParsedPlan(null);
      setDebugInfo(null);
      setToast({ message: `Error al parsear: ${text}`, tone: "error" });
    } finally {
      setIsBusy(false);
    }
  }

  function handleSaveReplace() {
    if (!parsedPlan) return;

    savePlanV1(parsedPlan);

    // Politica simple para evitar referencias huerfanas de opciones/ejercicios
    // cuando cambia completamente la estructura del plan importado.
    saveSelectionsV1(defaultSelectionsV1());

    setToast({ message: "Plan guardado y reemplazado.", tone: "success" });
    setTimeout(() => {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push("/settings");
      }
    }, 250);
  }

  if (isReady && canAccess === false) {
    return (
      <EmptyState
        title="Sin acceso"
        description="Solo el usuario admin puede entrar en Importar."
      />
    );
  }

  if (!isReady) {
    return (
      <Card title="Cargando permisos">
        <Skeleton lines={3} />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-[color:color-mix(in_oklab,var(--primary-end)_48%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_80%,var(--primary-end)_20%)] p-4 shadow-[0_14px_28px_rgba(108,93,211,0.16)] animate-card">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label="Volver"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--progress-chip-bg)] text-[var(--progress-chip-fg)]"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/settings");
              }
            }}
          >
            {"<"}
          </button>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Importar plan</h2>
          <span className="h-8 w-8" />
        </div>
      </section>

      <Card title="Importar Plan" subtitle="Sube un archivo y revisa el resumen antes de reemplazar">
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Sube un archivo .xlsx y se parsearan solo las hojas PLAN NUTRICIONAL y PLAN ENTRENAMIENTO.
          </p>

          <input
            type="file"
            accept=".xlsx,.xlsm,.xls"
            className="block w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
            onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
            disabled={isBusy}
          />

          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            disabled={!parsedPlan || isBusy}
            onClick={handleSaveReplace}
          >
            Guardar y reemplazar plan
          </button>

          <Toast
            message={toast?.message ?? null}
            tone={toast?.tone ?? "info"}
            onClose={() => setToast(null)}
          />
        </div>
      </Card>

      {!parsedPlan ? (
        isBusy ? (
          <Card title="Procesando archivo">
            <Skeleton lines={5} />
          </Card>
        ) : (
          <EmptyState
            title="Sin preview"
            description="Carga un Excel para ver el resumen antes de guardar."
          />
        )
      ) : (
        <>
          <Card title="Preview nutricion" subtitle="Resumen por dia y comida">
            <div className="space-y-2 text-sm text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">
                Archivo: {sourceName} | Dias detectados: {parsedPlan.nutrition.days.length}
              </p>
              <ul className="space-y-1">
                {nutritionRows.map((row) => (
                  <li key={row.key} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                    <p className="font-semibold text-[var(--foreground)]">
                      Semana {row.weekIndex} - {row.dayOfWeek}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {row.counts.map((item) => `${item.mealType}: ${item.count}`).join(" | ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card title="Preview entrenamiento" subtitle="Dias y cantidad de ejercicios">
            <ul className="space-y-1 text-sm text-[var(--muted)]">
              {parsedPlan.training.days.map((day) => (
                <li key={day.dayIndex} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                  <span className="font-semibold text-[var(--foreground)]">{day.label}</span>
                  <span className="ml-2 text-[var(--muted)]">
                    ({day.exercises.length} ejercicios)
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Debug parser" subtitle="Informacion tecnica del parseo">
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">
                Ver detalles de deteccion
              </summary>
              <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
                <p>
                  Fila encabezados dias:{" "}
                  {debugInfo?.nutrition?.headerRowIndex !== undefined
                    ? debugInfo.nutrition.headerRowIndex
                    : "N/A"}
                </p>
                <p>
                  Columnas week1:{" "}
                  {debugInfo?.nutrition?.week1Columns
                    ? JSON.stringify(debugInfo.nutrition.week1Columns)
                    : "N/A"}
                </p>
                <p>
                  Columnas week2:{" "}
                  {debugInfo?.nutrition?.week2Columns
                    ? JSON.stringify(debugInfo.nutrition.week2Columns)
                    : "N/A"}
                </p>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">Bloques de comida:</p>
                  <ul className="mt-1 space-y-1">
                    {debugInfo?.nutrition?.mealBlocks?.map((block) => (
                      <li key={`${block.mealType}-${block.startRow}`}>
                        {block.mealType}: filas {block.startRow} a {block.endRow}
                      </li>
                    )) ?? <li>N/A</li>}
                  </ul>
                </div>
              </div>
            </details>
          </Card>
        </>
      )}
    </div>
  );
}
