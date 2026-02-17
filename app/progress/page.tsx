"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { buildProgressBlocks, type ProgressPoint } from "@/lib/progress";
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
  if (points.length === 0) {
    return (
      <div className="mt-2 h-18 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-xs text-[var(--muted)]">
        Sin datos de peso
      </div>
    );
  }

  const values = points.map((point) => point.weightKg);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 260;
  const height = 72;
  const padding = 8;

  const chartPoints = points.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
    const normalized = (point.weightKg - min) / range;
    const y = height - padding - normalized * (height - padding * 2);
    return { x, y };
  });

  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-18 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-soft)]">
      <polyline
        fill="none"
        stroke="var(--primary-end)"
        strokeWidth="2.5"
        points={polyline}
      />
      {chartPoints.map((point, idx) => (
        <circle
          key={`${point.x}-${point.y}-${idx}`}
          cx={point.x}
          cy={point.y}
          r="3.2"
          fill="var(--surface)"
          stroke="var(--primary-end)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

export default function ProgressPage() {
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
    return buildProgressBlocks(plan, selections, settings);
  }, [plan, settings, selections]);

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

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_oklab,var(--primary-end)_50%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_82%,var(--primary-end)_18%)] p-4 shadow-[0_10px_24px_rgba(108,93,211,0.16)] animate-card">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Progreso</h2>
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
            <Card key={`${selectedBlock.blockId}-${exercise.exerciseIndex}`}>
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
              <Sparkline points={exercise.points.slice(-6)} />
            </Card>
          ))}

          <div className="px-1 pb-1 text-center">
            <Link
              href={`/progress/${selectedBlock.blockId}`}
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
