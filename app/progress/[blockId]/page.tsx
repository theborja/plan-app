"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { buildProgressBlocks, type ProgressPoint } from "@/lib/progress";
import { loadPlanV1, loadSelectionsV1, loadSettingsV1 } from "@/lib/storage";
import type { PlanV1, SelectionsV1, SettingsV1 } from "@/lib/types";

type Period = "week" | "month" | "all";

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

function filterPointsByPeriod(points: ProgressPoint[], period: Period): ProgressPoint[] {
  if (period === "all") return points;
  if (points.length === 0) return [];

  const latest = parseIsoDate(points[points.length - 1].isoDate);
  const minDate = new Date(latest);
  minDate.setDate(minDate.getDate() - (period === "week" ? 42 : 180));

  return points.filter((point) => parseIsoDate(point.isoDate) >= minDate);
}

function MainChart({ points }: { points: ProgressPoint[] }) {
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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-44 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-soft)]">
      <defs>
        <linearGradient id="progressFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary-end)" stopOpacity="0.24" />
          <stop offset="100%" stopColor="var(--primary-end)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke="var(--primary-end)" strokeWidth="3" points={polyline} />
      {chartPoints.map((point, idx) => (
        <circle
          key={`${point.x}-${point.y}-${idx}`}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="var(--surface)"
          stroke="var(--primary-end)"
          strokeWidth="2"
        />
      ))}
      <text x={padding} y={height - 4} fontSize="10" fill="var(--muted)">
        {points[0].isoDate}
      </text>
      <text x={width - padding - 56} y={height - 4} fontSize="10" fill="var(--muted)">
        {points[points.length - 1].isoDate}
      </text>
    </svg>
  );
}

export default function ProgressBlockDetailPage() {
  const params = useParams<{ blockId: string }>();
  const blockId = params?.blockId ?? "";

  const [plan, setPlan] = useState<PlanV1 | null>(null);
  const [settings, setSettings] = useState<SettingsV1 | null>(null);
  const [selections, setSelections] = useState<SelectionsV1 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");
  const [exerciseIndex, setExerciseIndex] = useState(0);

  useEffect(() => {
    setPlan(loadPlanV1());
    setSettings(loadSettingsV1());
    setSelections(loadSelectionsV1());
    setIsLoading(false);
  }, []);

  const blocks = useMemo(() => {
    if (!plan || !settings || !selections) return [];
    return buildProgressBlocks(plan, selections, settings);
  }, [plan, settings, selections]);

  const block = blocks.find((item) => item.blockId === blockId) ?? null;

  useEffect(() => {
    setExerciseIndex(0);
  }, [blockId]);

  const exercise = block?.exercises[exerciseIndex] ?? null;
  const filteredPoints = useMemo(
    () => (exercise ? filterPointsByPeriod(exercise.points, period) : []),
    [exercise, period],
  );
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
      <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_oklab,var(--primary-end)_50%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_82%,var(--primary-end)_18%)] p-4 shadow-[0_10px_24px_rgba(108,93,211,0.16)] animate-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Progreso {block.blockFullLabel}</h2>
          <Link href="/progress" className="text-xs font-semibold text-[var(--primary-end)]">
            Volver
          </Link>
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {block.exercises.map((item, idx) => (
            <button
              key={`${item.exerciseIndex}-${item.exerciseName}`}
              type="button"
              onClick={() => setExerciseIndex(idx)}
              className={[
                "shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition",
                idx === exerciseIndex
                  ? "bg-white text-[var(--foreground)] shadow-sm"
                  : "bg-[var(--surface-soft)] text-[var(--muted)]",
              ].join(" ")}
            >
              {item.exerciseName}
            </button>
          ))}
        </div>
      </section>

      <Card title={`Progreso de ${exercise.exerciseName}`}>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-1 text-xs font-semibold">
          {(["week", "month", "all"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              className={[
                "rounded-lg px-2 py-1.5 transition",
                period === item ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]",
              ].join(" ")}
            >
              {item === "week" ? "Semana" : item === "month" ? "Mes" : "Todo"}
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

        <MainChart points={filteredPoints} />

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
            filteredPoints
              .slice()
              .reverse()
              .map((point, idx, arr) => {
                const prev = arr[idx + 1];
                const delta = prev ? point.weightKg - prev.weightKg : null;
                return (
                  <li
                    key={`${point.isoDate}-${point.weightKg}-${idx}`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--foreground)]">{point.isoDate}</span>
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
      </Card>
    </div>
  );
}
