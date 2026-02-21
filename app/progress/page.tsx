"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import NoPlanState from "@/components/NoPlanState";
import Skeleton from "@/components/Skeleton";
import { fetchJson } from "@/lib/clientApi";

type ProgressPoint = { isoDate: string; weightKg: number };
type Block = {
  blockId: string;
  blockTabLabel: string;
  blockFullLabel: string;
  weeklyAvgPct: number | null;
  monthlyAvgPct: number | null;
  weeklyTotalKg: number | null;
  monthlyTotalKg: number | null;
  exercises: Array<{
    exerciseIndex: number;
    exerciseName: string;
    weeklyDeltaPct: number | null;
    monthlyDeltaPct: number | null;
    points: ProgressPoint[];
  }>;
};

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
    return <div className="mt-2 h-18 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-xs text-[var(--muted)]">Sin datos de peso</div>;
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
  const last = visiblePoints[visiblePoints.length - 1];
  const footerWeight =
    selectedPointIndex !== null ? visiblePoints[selectedPointIndex].weightKg : last.weightKg;

  return (
    <div
      className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] p-2"
      onClick={(event) => event.stopPropagation()}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-18 w-full"
        onClick={(event) => {
          event.stopPropagation();
          setSelectedPointIndex(null);
        }}
      >
        <polyline fill="none" stroke="var(--primary-end)" strokeWidth="2.5" points={polyline} />
        {chartPoints.map((point, idx) => {
          const selected = selectedPointIndex === idx;
          return (
            <g key={`${point.x}-${idx}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="3.2"
                fill="var(--surface)"
                stroke="var(--primary-end)"
                strokeWidth="2"
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedPointIndex((prev) => (prev === idx ? null : idx));
                }}
              />
              {selected ? (
                <g>
                  <rect
                    x={Math.max(8, point.x - 24)}
                    y={Math.max(2, point.y - 22)}
                    width="48"
                    height="14"
                    rx="7"
                    fill="var(--surface)"
                    stroke="var(--border)"
                  />
                  <text
                    x={point.x}
                    y={Math.max(12, point.y - 12)}
                    fontSize="9"
                    textAnchor="middle"
                    fill="var(--foreground)"
                    className="font-semibold"
                  >
                    {visiblePoints[idx].weightKg} kg
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
        <span>Semana 1</span>
        <span className="font-semibold text-[var(--foreground)]">Actual: {footerWeight} kg</span>
        <span>Semana {visiblePoints.length}</span>
      </div>
      {selectedPointIndex !== null ? (
        <p className="mt-1 text-center text-[10px] text-[var(--muted)]">
          Semana del {visiblePoints[selectedPointIndex].isoDate}
        </p>
      ) : null}
    </div>
  );
}

export default function ProgressPage() {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [preferredBlockId, setPreferredBlockId] = useState<string | null>(null);
  const [noPlan, setNoPlan] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const response = await fetchJson<{ ok: true; blocks: Block[]; preferredBlockId: string | null; noPlan: boolean }>("/api/progress/blocks");
        setBlocks(response.blocks);
        setPreferredBlockId(response.preferredBlockId);
        setNoPlan(response.noPlan);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (blocks.length === 0) {
      setSelectedBlockId(null);
      return;
    }
    if (!selectedBlockId || !blocks.some((item) => item.blockId === selectedBlockId)) {
      const preferredExists = preferredBlockId && blocks.some((item) => item.blockId === preferredBlockId);
      setSelectedBlockId(preferredExists ? preferredBlockId : blocks[0].blockId);
    }
  }, [blocks, preferredBlockId, selectedBlockId]);

  const selectedBlock = useMemo(
    () => blocks.find((item) => item.blockId === selectedBlockId) ?? null,
    [blocks, selectedBlockId],
  );

  if (isLoading) {
    return (
      <Card title="Cargando progreso">
        <Skeleton lines={4} />
      </Card>
    );
  }

  if (noPlan || blocks.length === 0 || !selectedBlock) {
    return <NoPlanState />;
  }

  const getDetailHref = (exerciseIndex?: number) => {
    if (exerciseIndex === undefined) return `/progress/${selectedBlock.blockId}`;
    return `/progress/${selectedBlock.blockId}?exercise=${exerciseIndex}`;
  };

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-[color:color-mix(in_oklab,var(--primary-end)_48%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_80%,var(--primary-end)_20%)] p-4 shadow-[0_14px_28px_rgba(108,93,211,0.16)] animate-card">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Progreso</h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {blocks.map((block) => (
            <button key={block.blockId} type="button" onClick={() => setSelectedBlockId(block.blockId)} className={["shrink-0 rounded-xl px-4 py-2 text-sm font-semibold", block.blockId === selectedBlockId ? "bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] text-white" : "bg-[var(--progress-chip-muted-bg)] text-[var(--progress-chip-muted-fg)]"].join(" ")}>
              {block.blockTabLabel}
            </button>
          ))}
        </div>
      </section>

      <Card title={`Estadisticas de ${selectedBlock.blockFullLabel}`}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Semana</p>
            <p className={["mt-1 text-2xl font-bold", toneFromDelta(selectedBlock.weeklyAvgPct)].join(" ")}>{formatDeltaPct(selectedBlock.weeklyAvgPct)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{formatDeltaKg(selectedBlock.weeklyTotalKg)}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Mes</p>
            <p className={["mt-1 text-2xl font-bold", toneFromDelta(selectedBlock.monthlyAvgPct)].join(" ")}>{formatDeltaPct(selectedBlock.monthlyAvgPct)}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{formatDeltaKg(selectedBlock.monthlyTotalKg)}</p>
          </div>
        </div>
      </Card>

      {selectedBlock.exercises.map((exercise) => (
        <div key={`${selectedBlock.blockId}-${exercise.exerciseIndex}`} className="block cursor-pointer" onClick={() => router.push(getDetailHref(exercise.exerciseIndex))} role="button" tabIndex={0}>
          <Card>
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">{exercise.exerciseName}</p>
              <div className="text-right text-xs">
                <p className={["font-semibold", toneFromDelta(exercise.weeklyDeltaPct)].join(" ")}>{formatDeltaPct(exercise.weeklyDeltaPct)}</p>
                <p className={["mt-1", toneFromDelta(exercise.monthlyDeltaPct)].join(" ")}>{formatDeltaPct(exercise.monthlyDeltaPct)}</p>
              </div>
            </div>
            <Sparkline points={exercise.points.slice(-6)} />
          </Card>
        </div>
      ))}

      <div className="px-1 pb-1 text-center">
        <Link href={getDetailHref()} className="inline-flex text-sm font-semibold text-[var(--primary-end)]">Ver mas</Link>
      </div>
    </div>
  );
}
