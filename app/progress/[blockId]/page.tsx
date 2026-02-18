"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import { formatDateDDMMYYYY } from "@/lib/date";
import { buildProgressBlocks, type ProgressPoint, withMockProgressData } from "@/lib/progress";
import { loadPlanV1, loadSelectionsV1, loadSettingsV1 } from "@/lib/storage";
import type { PlanV1, SelectionsV1, SettingsV1 } from "@/lib/types";

type Period = "week" | "month";

function parseIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDelta(value: number | null): string {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function toneFromDelta(value: number | null): string {
  if (value === null) return "text-[var(--muted)]";
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-[var(--muted)]";
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function aggregateByMonth(points: ProgressPoint[]): ProgressPoint[] {
  const byMonth = new Map<string, ProgressPoint>();
  for (const point of points) {
    byMonth.set(monthKey(point.isoDate), point);
  }
  return Array.from(byMonth.values()).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

function filterPointsByPeriod(points: ProgressPoint[], period: Period): ProgressPoint[] {
  if (points.length === 0) return [];

  const latest = parseIsoDate(points[points.length - 1].isoDate);
  const minDate = new Date(latest);
  minDate.setDate(minDate.getDate() - (period === "week" ? 84 : 365));

  const scoped = points.filter((point) => parseIsoDate(point.isoDate) >= minDate);
  if (period === "week") {
    return scoped;
  }

  return aggregateByMonth(scoped);
}

function MainChart({ points, period }: { points: ProgressPoint[]; period: Period }) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedPointIndex(null);
  }, [period, points]);

  if (points.length === 0) {
    return (
      <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-4 text-sm text-[var(--muted)]">
        Sin datos en este periodo.
      </div>
    );
  }

  const width = 320;
  const height = 160;
  const padding = 18;
  const values = points.map((p) => p.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const chartPoints = points.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
    const y =
      height -
      padding -
      ((point.weightKg - min) / range) * (height - padding * 2);
    return { x, y, weight: point.weightKg };
  });

  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const labels =
    period === "month"
      ? points.map((point) => formatDateDDMMYYYY(point.isoDate))
      : points.map((_, index) => `Semana ${index + 1}`);
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
        <defs>
          <linearGradient id="progressFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--primary-end)" stopOpacity="0.24" />
            <stop offset="100%" stopColor="var(--primary-end)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polyline fill="none" stroke="var(--primary-end)" strokeWidth="3" points={polyline} />
        {chartPoints.map((point, idx) => (
          <g key={`${point.x}-${point.y}-${idx}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="var(--surface)"
              stroke="var(--primary-end)"
              strokeWidth="2"
              className="cursor-pointer"
              onClick={() => setSelectedPointIndex((prev) => (prev === idx ? null : idx))}
            />
          </g>
        ))}
        {selectedPointIndex !== null ? (
          <g>
            <rect
              x={Math.max(8, chartPoints[selectedPointIndex].x - 26)}
              y={Math.max(4, chartPoints[selectedPointIndex].y - 24)}
              width="52"
              height="16"
              rx="8"
              fill="var(--surface)"
              stroke="var(--border)"
            />
            <text
              x={chartPoints[selectedPointIndex].x}
              y={Math.max(15, chartPoints[selectedPointIndex].y - 13)}
              fontSize="9"
              textAnchor="middle"
              fill="var(--foreground)"
              className="font-semibold"
            >
              {points[selectedPointIndex].weightKg} kg
            </text>
          </g>
        ) : null}
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-[var(--muted)]">
        <span className="truncate">{labels[0]}</span>
        <span className="text-center font-semibold text-[var(--foreground)]">
          {first.weightKg} kg {"->"} {last.weightKg} kg
        </span>
        <span className="truncate text-right">{labels[labels.length - 1]}</span>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-[10px] text-[var(--muted)]">
        <span>Inicio: {formatDateDDMMYYYY(first.isoDate)}</span>
        <span className="text-right">Actual: {formatDateDDMMYYYY(last.isoDate)}</span>
      </div>
    </div>
  );
}

export default function ProgressBlockDetailPage() {
  const params = useParams<{ blockId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const blockId = params?.blockId ?? "";
  const requestedExercise = Number(searchParams.get("exercise"));
  const isMockUser = (user?.email ?? "").trim().toLowerCase() === "mock";

  const [plan, setPlan] = useState<PlanV1 | null>(null);
  const [settings, setSettings] = useState<SettingsV1 | null>(null);
  const [selections, setSelections] = useState<SelectionsV1 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [showAllHistory, setShowAllHistory] = useState(false);

  useEffect(() => {
    setPlan(loadPlanV1());
    setSettings(loadSettingsV1());
    setSelections(loadSelectionsV1());
    setIsLoading(false);
  }, []);

  const blocks = useMemo(() => {
    if (!plan || !settings || !selections) return [];
    const base = buildProgressBlocks(plan, selections, settings);
    return isMockUser ? withMockProgressData(base, 3) : base;
  }, [plan, settings, selections, isMockUser]);

  const block = blocks.find((item) => item.blockId === blockId) ?? null;

  useEffect(() => {
    setExerciseIndex(0);
  }, [blockId]);

  useEffect(() => {
    if (!block) return;
    if (!Number.isInteger(requestedExercise) || requestedExercise < 0) return;
    const clamped = Math.min(requestedExercise, Math.max(block.exercises.length - 1, 0));
    setExerciseIndex(clamped);
  }, [block, requestedExercise]);

  const exercise = block?.exercises[exerciseIndex] ?? null;
  const filteredPoints = useMemo(
    () => (exercise ? filterPointsByPeriod(exercise.points, period) : []),
    [exercise, period],
  );
  const reversedPoints = useMemo(() => filteredPoints.slice().reverse(), [filteredPoints]);
  const visibleHistoryPoints = showAllHistory ? reversedPoints : reversedPoints.slice(0, 4);
  const hasMoreHistory = reversedPoints.length > 4;
  const monthlyImprovementKg = useMemo(() => {
    if (!exercise || exercise.points.length < 2) return null;
    const latest = exercise.points[exercise.points.length - 1];
    const latestDate = parseIsoDate(latest.isoDate);
    const monthBack = new Date(latestDate);
    monthBack.setDate(monthBack.getDate() - 30);

    let reference: ProgressPoint | null = null;
    for (let idx = exercise.points.length - 2; idx >= 0; idx -= 1) {
      const point = exercise.points[idx];
      if (parseIsoDate(point.isoDate) <= monthBack) {
        reference = point;
        break;
      }
    }

    if (!reference) return null;
    return latest.weightKg - reference.weightKg;
  }, [exercise]);

  const goToBlock = (targetBlockId: string): void => {
    if (!targetBlockId || targetBlockId === blockId) return;
    const params = new URLSearchParams();
    params.set("exercise", String(exerciseIndex));
    const query = params.toString();
    const href = query ? `/progress/${targetBlockId}?${query}` : `/progress/${targetBlockId}`;
    router.push(href);
  };

  if (!plan) {
    return (
      <div className="space-y-4">
        {isLoading ? (
          <Card title="Cargando progreso">
            <Skeleton lines={5} />
          </Card>
        ) : (
          <EmptyState
            title="No hay plan cargado"
            description="Importa un plan para ver progreso."
            action={
              <Link
                href="/import"
                className="inline-flex rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-4 py-2 text-sm font-semibold text-white"
              >
                Ir a importar
              </Link>
            }
          />
        )}
      </div>
    );
  }

  if (!block) {
    return (
      <Card title="Progreso">
        <p className="text-sm text-[var(--muted)]">Bloque no encontrado.</p>
        <Link href="/progress" className="mt-3 inline-flex text-sm font-semibold text-[var(--primary-end)]">
          Volver a Progreso
        </Link>
      </Card>
    );
  }

  if (!exercise) {
    return (
      <Card title={`Progreso ${block.blockName}`}>
        <p className="text-sm text-[var(--muted)]">No hay ejercicios en este bloque.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-[color:color-mix(in_oklab,var(--primary-end)_48%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_80%,var(--primary-end)_20%)] p-4 shadow-[0_14px_28px_rgba(108,93,211,0.16)] animate-card">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/progress"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--progress-chip-bg)] text-[var(--progress-chip-fg)]"
            aria-label="Volver"
          >
            {"<"}
          </Link>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Progreso</h2>
          <span className="h-8 w-8" />
        </div>
        <div className="mt-2">
          <label className="sr-only" htmlFor="block-selector">
            Seleccionar bloque
          </label>
          <select
            id="block-selector"
            value={block.blockId}
            onChange={(event) => goToBlock(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--progress-chip-bg)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
          >
            {blocks.map((item) => (
              <option
                key={item.blockId}
                value={item.blockId}
                style={{ color: "#0f172a", backgroundColor: "#ffffff" }}
              >
                {item.blockFullLabel}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 rounded-lg bg-[var(--progress-chip-bg)] px-3 py-2 text-center text-xs font-semibold text-[var(--progress-chip-fg)] shadow-sm">
              <div className="mx-auto max-w-[90%] truncate text-center">{block.exercises[exerciseIndex]?.exerciseName ?? "-"}</div>
              <div className="mt-2 flex items-center justify-center gap-2">
                {block.exercises.map((item, idx) => (
                  <button
                    key={`${item.exerciseIndex}-dot`}
                    type="button"
                    onClick={() => setExerciseIndex(idx)}
                    className={[
                      "h-2.5 w-2.5 rounded-full transition",
                      idx === exerciseIndex ? "bg-[var(--progress-chip-fg)]" : "bg-[var(--progress-chip-muted-fg)]",
                    ].join(" ")}
                    aria-label={`Ir al ejercicio ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setExerciseIndex((prev) => (prev + 1) % block.exercises.length)}
              disabled={block.exercises.length <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--progress-chip-bg)] text-[var(--progress-chip-fg)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Ejercicio siguiente"
            >
              {">"}
            </button>
          </div>
        </div>
      </section>

      <Card title={`Progreso de ${exercise.exerciseName}`}>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-1 text-xs font-semibold">
          {(["week", "month"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={[
                "rounded-lg px-2 py-1.5 transition",
                period === item
                  ? "bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] text-white shadow-sm"
                  : "bg-[var(--progress-chip-muted-bg)] text-[var(--progress-chip-muted-fg)]",
              ].join(" ")}
            >
              {item === "week" ? "Semana" : "Mes"}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Semanal</p>
            <p className={["text-2xl font-bold", toneFromDelta(exercise.weeklyDeltaPct)].join(" ")}>
              {formatDelta(exercise.weeklyDeltaPct)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Mensual</p>
            <p className={["text-2xl font-bold", toneFromDelta(exercise.monthlyDeltaPct)].join(" ")}>
              {formatDelta(exercise.monthlyDeltaPct)}
            </p>
          </div>
        </div>

        <MainChart points={filteredPoints} period={period} />

        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-center">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {monthlyImprovementKg === null
              ? "Sin referencia mensual suficiente"
              : `${monthlyImprovementKg > 0 ? "+" : ""}${monthlyImprovementKg.toFixed(1)} kg de mejora este mes`}
          </p>
        </div>
      </Card>

      <Card title="Historial reciente">
        <ul className="space-y-2 text-sm">
          {filteredPoints.length === 0 ? (
            <li className="text-[var(--muted)]">Sin registros para este periodo.</li>
          ) : (
            visibleHistoryPoints.map((point, idx) => {
                const prev = reversedPoints[idx + 1];
                const delta = prev ? point.weightKg - prev.weightKg : null;
                return (
                  <li
                    key={`${point.isoDate}-${point.weightKg}-${idx}`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--foreground)]">{formatDateDDMMYYYY(point.isoDate)}</span>
                      <span className="font-semibold text-[var(--foreground)]">{point.weightKg} kg</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {delta === null ? "Primer registro" : `Cambio vs anterior: ${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`}
                    </p>
                  </li>
                );
              })
          )}
        </ul>
        {hasMoreHistory ? (
          <button
            type="button"
            onClick={() => setShowAllHistory((prev) => !prev)}
            className="mt-3 text-sm font-semibold text-[var(--primary-end)]"
          >
            {showAllHistory ? "Ver menos" : `Ver ${reversedPoints.length - 4} mas`}
          </button>
        ) : null}
      </Card>
    </div>
  );
}

