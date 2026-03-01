"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import Toast from "@/components/Toast";
import { fetchJson } from "@/lib/clientApi";
import { isAdminUser } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { parseWorkbookToPlanV1, type ParseWorkbookDebug } from "@/lib/parsers/parseWorkbookPlan";
import type { MealType, PlanV1 } from "@/lib/types";

const MEAL_TYPES: MealType[] = ["DESAYUNO", "ALMUERZO", "COMIDA", "MERIENDA", "CENA", "POSTRE"];

type AssignableUser = { id: string; email: string; name: string; role: "ADMIN" | "USER" };

export default function ImportPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const [parsedPlan, setParsedPlan] = useState<PlanV1 | null>(null);
  const [debugInfo, setDebugInfo] = useState<ParseWorkbookDebug | null>(null);
  const [sourceName, setSourceName] = useState<string>("");
  const [targetUserId, setTargetUserId] = useState("");
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" | "info" } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const canAccess = user ? isAdminUser(user) : false;

  useEffect(() => {
    if (!isReady || !canAccess) return;
    void (async () => {
      try {
        const data = await fetchJson<{ ok: true; users: AssignableUser[] }>("/api/users/assignable");
        setUsers(data.users);
        if (data.users.length > 0) {
          setTargetUserId(data.users[0].id);
        }
      } catch (error) {
        setToast({
          message: error instanceof Error ? error.message : "No se pudieron cargar usuarios.",
          tone: "error",
        });
      }
    })();
  }, [isReady, canAccess]);

  const nutritionRows = useMemo(() => {
    if (!parsedPlan) return [];
    return parsedPlan.nutrition.days.map((day) => ({
      key: `W${day.weekIndex}-${day.dayOfWeek}`,
      weekIndex: day.weekIndex,
      dayOfWeek: day.dayOfWeek,
      counts: MEAL_TYPES.map((mealType) => ({ mealType, count: day.meals[mealType]?.length ?? 0 })),
    }));
  }, [parsedPlan]);

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
      setFileToUpload(file);
      setToast({ message: "Archivo parseado correctamente.", tone: "success" });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Error desconocido";
      setParsedPlan(null);
      setDebugInfo(null);
      setFileToUpload(null);
      setToast({ message: `Error al parsear: ${text}`, tone: "error" });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveReplace() {
    if (!fileToUpload || !targetUserId) return;

    setIsBusy(true);
    setToast({ message: "Importando en BBDD...", tone: "info" });

    try {
      const form = new FormData();
      form.set("file", fileToUpload);
      form.set("targetUserId", targetUserId);

      const response = await fetch("/api/plans/import", {
        method: "POST",
        credentials: "include",
        body: form,
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo importar el plan.");
      }

      setToast({ message: "Plan importado y asignado correctamente.", tone: "success" });
      setTimeout(() => router.push("/settings"), 350);
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "No se pudo importar el plan.",
        tone: "error",
      });
    } finally {
      setIsBusy(false);
    }
  }

  if (isReady && canAccess === false) {
    return <EmptyState title="Sin acceso" description="Solo el usuario admin puede entrar en Importar." />;
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
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
        onClick={() => router.push("/settings")}
      >
        {"<"} Volver
      </button>

      <Card title="Importar plan" subtitle="Sube Excel, elige usuario destino y guarda en BBDD">
        <div className="space-y-3">
          <label className="block text-sm text-[var(--muted)]" htmlFor="target-user">
            Usuario destino
          </label>
          <select
            id="target-user"
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            disabled={users.length === 0 || isBusy}
          >
            {users.map((item) => (
              <option key={item.id} value={item.id}>
                {item.email} ({item.role})
              </option>
            ))}
          </select>

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
            disabled={!parsedPlan || !targetUserId || isBusy}
            onClick={() => void handleSaveReplace()}
          >
            Guardar y asignar plan
          </button>

          <Toast message={toast?.message ?? null} tone={toast?.tone ?? "info"} onClose={() => setToast(null)} />
        </div>
      </Card>

      {!parsedPlan ? (
        isBusy ? (
          <Card title="Procesando archivo">
            <Skeleton lines={5} />
          </Card>
        ) : (
          <EmptyState title="Sin preview" description="Carga un Excel para ver el resumen antes de guardar." />
        )
      ) : (
        <>
          <Card title="Preview nutricion" subtitle="Resumen por dia y comida">
            <div className="space-y-2 text-sm text-[var(--muted)]">
              <p className="font-semibold text-[var(--foreground)]">
                Archivo: {sourceName} | Dias detectados: {parsedPlan.nutrition.days.length}
              </p>
              {nutritionRows.length === 0 ? (
                <p className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-xs">
                  Este archivo no incluye la hoja PLAN NUTRICIONAL. Se importara solo entrenamiento.
                </p>
              ) : (
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
              )}
            </div>
          </Card>

          <Card title="Preview entrenamiento" subtitle="Dias y cantidad de ejercicios">
            <ul className="space-y-1 text-sm text-[var(--muted)]">
              {parsedPlan.training.days.map((day) => (
                <li key={day.dayIndex} className="rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                  <span className="font-semibold text-[var(--foreground)]">{day.label}</span>
                  <span className="ml-2 text-[var(--muted)]">({day.exercises.length} ejercicios)</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Debug parser" subtitle="Informacion tecnica del parseo">
            <details>
              <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">Ver detalles de deteccion</summary>
              <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
                <p>Fila encabezados dias: {debugInfo?.nutrition?.headerRowIndex ?? "N/A"}</p>
                <p>
                  Columnas week1: {debugInfo?.nutrition?.week1Columns ? JSON.stringify(debugInfo.nutrition.week1Columns) : "N/A"}
                </p>
                <p>
                  Columnas week2: {debugInfo?.nutrition?.week2Columns ? JSON.stringify(debugInfo.nutrition.week2Columns) : "N/A"}
                </p>
              </div>
            </details>
          </Card>
        </>
      )}
    </div>
  );
}
