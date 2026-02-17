"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { buildProgressBlocks, type ProgressPoint, withMockProgressData } from "@/lib/progress";
import {
  loadPlanV1,
  loadSelectionsV1,
  loadSettingsV1,
} from "@/lib/storage";
import type { PlanV1, SelectionsV1, SettingsV1 } from "@/lib/types";

function formatDeltaPct(value: number | null): string {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatDeltaKg(value: number | null): string {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} kg`;
}

function toneFromDelta(value: number | null): string {
  if (value === null) return "text-[var(--muted)]";
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-[var(--muted)]";
}

function Sparkline({ points }: { points: ProgressPoint[] }) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const visiblePoints = points.slice(-4);

  if (visiblePoints.length === 0) {
    return (
      <div className="mt-2 h-18 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-xs text-[var(--muted)]">
        Sin datos de peso
      </div>
    );
  }

  const values = visiblePoints.map((point) => point.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 260;
  const height = 72;
  const padding = 8;

  const chartPoints = visiblePoints.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(visiblePoints.length - 1, 1);
    const normalized = (point.weightKg - min) / range;
    const y = height - padding - normalized * (height - padding * 2);
    return { x, y };
  });

  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const weekLabels = visiblePoints.map((_, index) => `Semana ${index + 1}`);
  const last = visiblePoints[visiblePoints.length - 1];

  return (
    <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-18 w-full">
        <polyline
          fill="none"
          stroke="var(--primary-end)"
          strokeWidth="2.5"
          points={polyline}
        />
        {chartPoints.map((point, idx) => (
          <g key={`${point.x}-${point.y}-${idx}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="3.2"
              fill="var(--surface)"
              stroke="var(--primary-end)"
              strokeWidth="2"
              className="cursor-pointer"
              onClick={() =>
                setSelectedPointIndex((prev) => (prev === idx ? null : idx))
              }
            />
          </g>
        ))}
        {selectedPointIndex !== null ? (
          <g>
            <rect
              x={Math.max(8, chartPoints[selectedPointIndex].x - 24)}
              y={Math.max(2, chartPoints[selectedPointIndex].y - 22)}
              width="48"
              height="14"
              rx="7"
              fill="var(--surface)"
              stroke="var(--border)"
            />
            <text
              x={chartPoints[selectedPointIndex].x}
              y={Math.max(12, chartPoints[selectedPointIndex].y - 12)}
              fontSize="9"
              textAnchor="middle"
              fill="var(--foreground)"
              className="font-semibold"
            >
              {visiblePoints[selectedPointIndex].weightKg} kg
            </text>
          </g>
        ) : null}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
        <span>{weekLabels[0]}</span>
        <span className="font-semibold text-[var(--foreground)]">Actual: {last.weightKg} kg</span>
        <span>{weekLabels[weekLabels.length - 1]}</span>
      </div>
    </div>
  );
}

export default function ProgressPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<PlanV1 | null>(null);
  const [settings, setSettings] = useState<SettingsV1 | null>(null);
  const [selections, setSelections] = useState<SelectionsV1 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  useEffect(() => {
    setPlan(loadPlanV1());
    setSettings(loadSettingsV1());
    setSelections(loadSelectionsV1());
    setIsLoading(false);
  }, []);

  const blocks = useMemo(() => {
    if (!plan || !settings || !selections) return [];
    const base = buildProgressBlocks(plan, selections, settings);
    const mockEnabled = searchParams.get("mock") === "1";
    return mockEnabled ? withMockProgressData(base, 3) : base;
  }, [plan, settings, selections, searchParams]);
  const mockEnabled = searchParams.get("mock") === "1";

  useEffect(() => {
    if (blocks.length === 0) {
      setSelectedBlockId(null);
      return;
    }

    const exists = blocks.some((block) => block.blockId === selectedBlockId);
    if (!selectedBlockId || !exists) {
      setSelectedBlockId(blocks[0].blockId);
    }
  }, [blocks, selectedBlockId]);

  const selectedBlock = blocks.find((block) => block.blockId === selectedBlockId) ?? null;

  if (!plan) {
    return (
      <div className="space-y-4">
        {isLoading ? (
          <Card title="Cargando progreso">
            <Skeleton lines={4} />
          </Card>
        ) : (
          <EmptyState
            title="No hay plan cargado"
            description="Importa un plan para ver tu progreso."
            action={(
              <Link
                href="/import"
                className="inline-flex rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-4 py-2 text-sm font-semibold text-white"
              >
                Ir a importar
              </Link>
            )}
          />
        )}
      </div>
    );
  }

  if (!selectedBlock) {
    return (
      <Card title="Progreso">
        <p className="text-sm text-[var(--muted)]">No hay bloques de entrenamiento disponibles.</p>
      </Card>
    );
  }

  const getDetailHref = (exerciseIndex?: number) => {
    const base = `/progress/${selectedBlock.blockId}`;
    const params = new URLSearchParams();
    if (mockEnabled) params.set("mock", "1");
    if (exerciseIndex !== undefined) params.set("exercise", String(exerciseIndex));
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  };

  const toggleMock = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (mockEnabled) {
      params.delete("mock");
    } else {
      params.set("mock", "1");
    }
    const query = params.toString();
    router.push(query ? `/progress?${query}` : "/progress");
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-[color:color-mix(in_oklab,var(--primary-end)_48%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_80%,var(--primary-end)_20%)] p-4 shadow-[0_14px_28px_rgba(108,93,211,0.16)] animate-card">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-[var(--primary-end)]"
            aria-label="Volver"
          >
            {"<"}
          </button>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Progreso</h2>
          {mockEnabled ? (
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-[var(--muted)]">
                Mock 3 meses
              </span>
              <button
                type="button"
                className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-semibold text-[var(--primary-end)]"
                onClick={toggleMock}
              >
                Sin mock
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-[var(--primary-end)]"
              aria-label="Activar mock"
              onClick={toggleMock}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M20 11a8 8 0 1 1-2.3-5.7" />
                <path d="M20 4v7h-7" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {blocks.map((block) => (
            <button
              key={block.blockId}
              type="button"
              onClick={() => setSelectedBlockId(block.blockId)}
              className={[
                "shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition",
                block.blockId === selectedBlockId
                  ? "bg-white text-[var(--foreground)] shadow-sm"
                  : "bg-[var(--surface-soft)] text-[var(--muted)]",
              ].join(" ")}
            >
              {block.blockTabLabel}
            </button>
          ))}
        </div>
      </section>

      <Card title={`Estadisticas de ${selectedBlock.blockFullLabel}`}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Semana</p>
            <p className={["mt-1 text-2xl font-bold", toneFromDelta(selectedBlock.weeklyAvgPct)].join(" ")}>
              {formatDeltaPct(selectedBlock.weeklyAvgPct)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">{formatDeltaKg(selectedBlock.weeklyTotalKg)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Mes</p>
            <p className={["mt-1 text-2xl font-bold", toneFromDelta(selectedBlock.monthlyAvgPct)].join(" ")}>
              {formatDeltaPct(selectedBlock.monthlyAvgPct)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">{formatDeltaKg(selectedBlock.monthlyTotalKg)}</p>
          </div>
        </div>
      </Card>

      {selectedBlock.exercises.length === 0 ? (
        <Card title="Ejercicios">
          <p className="text-sm text-[var(--muted)]">No hay ejercicios en este bloque.</p>
        </Card>
      ) : (
        <>
          {selectedBlock.exercises.map((exercise) => (
            <div
              key={`${selectedBlock.blockId}-${exercise.exerciseIndex}`}
              className="block cursor-pointer"
              onClick={() => router.push(getDetailHref(exercise.exerciseIndex))}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(getDetailHref(exercise.exerciseIndex));
                }
              }}
            >
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{exercise.exerciseName}</p>
                  <div className="text-right text-xs">
                    <p className={["font-semibold", toneFromDelta(exercise.weeklyDeltaPct)].join(" ")}>
                      {formatDeltaPct(exercise.weeklyDeltaPct)}
                    </p>
                    <p className={["mt-1", toneFromDelta(exercise.monthlyDeltaPct)].join(" ")}>
                      {formatDeltaPct(exercise.monthlyDeltaPct)}
                    </p>
                  </div>
                </div>
                <div onClick={(event) => event.stopPropagation()}>
                  <Sparkline points={exercise.points.slice(-6)} />
                </div>
              </Card>
            </div>
          ))}

          <div className="px-1 pb-1 text-center">
            <Link
              href={getDetailHref()}
              className="inline-flex text-sm font-semibold text-[var(--primary-end)]"
            >
              Ver mas
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

