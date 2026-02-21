"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { fetchJson } from "@/lib/clientApi";
import { formatDateDDMMYYYY } from "@/lib/date";

type ProgressPoint = { isoDate: string; weightKg: number };
type Block = {
  blockId: string;
  blockFullLabel: string;
  exercises: Array<{
    exerciseIndex: number;
    exerciseName: string;
    weeklyDeltaPct: number | null;
    monthlyDeltaPct: number | null;
    points: ProgressPoint[];
  }>;
};

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
  for (const point of points) byMonth.set(monthKey(point.isoDate), point);
  return Array.from(byMonth.values()).sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

function filterPointsByPeriod(points: ProgressPoint[], period: Period): ProgressPoint[] {
  if (points.length === 0) return [];
  const latest = parseIsoDate(points[points.length - 1].isoDate);
  const minDate = new Date(latest);
  minDate.setDate(minDate.getDate() - (period === "week" ? 84 : 365));
  const scoped = points.filter((point) => parseIsoDate(point.isoDate) >= minDate);
  return period === "week" ? scoped : aggregateByMonth(scoped);
}

function formatMonthLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric" }).format(parseIsoDate(isoDate));
}

function MainChart({ points, period }: { points: ProgressPoint[]; period: Period }) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-4 text-sm text-[var(--muted)]">Sin datos en este periodo.</div>;
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
    const y = height - padding - ((point.weightKg - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const currentValue = points[points.length - 1].weightKg;
  const selectedValue =
    selectedPointIndex !== null ? points[selectedPointIndex].weightKg : currentValue;

  return (
    <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full"
        onClick={() => setSelectedPointIndex(null)}
      >
        <polyline fill="none" stroke="var(--primary-end)" strokeWidth="3" points={polyline} />
        {chartPoints.map((point, idx) => (
          <g key={`${point.x}-${idx}`}>
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="var(--surface)"
              stroke="var(--primary-end)"
              strokeWidth="2"
              className="cursor-pointer"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedPointIndex((prev) => (prev === idx ? null : idx));
              }}
            />
            {selectedPointIndex === idx ? (
              <g>
                <rect
                  x={Math.max(8, point.x - 28)}
                  y={Math.max(4, point.y - 24)}
                  width="56"
                  height="16"
                  rx="8"
                  fill="var(--surface)"
                  stroke="var(--border)"
                />
                <text
                  x={point.x}
                  y={Math.max(15, point.y - 13)}
                  fontSize="9"
                  textAnchor="middle"
                  fill="var(--foreground)"
                  className="font-semibold"
                >
                  {points[idx].weightKg} kg
                </text>
              </g>
            ) : null}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--muted)]">
        <span>{period === "month" ? formatMonthLabel(points[0].isoDate) : formatDateDDMMYYYY(points[0].isoDate)}</span>
        <span className="font-semibold text-[var(--foreground)]">Actual: {selectedValue} kg</span>
        <span>
          {period === "month"
            ? formatMonthLabel(points[points.length - 1].isoDate)
            : formatDateDDMMYYYY(points[points.length - 1].isoDate)}
        </span>
      </div>
      {selectedPointIndex !== null ? (
        <p className="mt-1 text-center text-[10px] text-[var(--muted)]">
          {period === "month"
            ? `Mes: ${formatMonthLabel(points[selectedPointIndex].isoDate)}`
            : `Semana del ${formatDateDDMMYYYY(points[selectedPointIndex].isoDate)}`}
        </p>
      ) : null}
    </div>
  );
}

export default function ProgressBlockDetailPage() {
  const params = useParams<{ blockId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const blockId = params?.blockId ?? "";
  const requestedExercise = Number(searchParams.get("exercise"));

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [block, setBlock] = useState<Block | null>(null);
  const [noPlan, setNoPlan] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");
  const [exerciseIndex, setExerciseIndex] = useState(0);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const data = await fetchJson<{ ok: true; block: Block | null; blocks: Block[]; noPlan: boolean }>(`/api/progress/block/${blockId}`);
        setBlock(data.block);
        setBlocks(data.blocks);
        setNoPlan(data.noPlan);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [blockId]);

  useEffect(() => {
    setExerciseIndex(0);
  }, [blockId]);

  useEffect(() => {
    if (!block) return;
    if (!Number.isInteger(requestedExercise) || requestedExercise < 0) return;
    setExerciseIndex(Math.min(requestedExercise, Math.max(0, block.exercises.length - 1)));
  }, [block, requestedExercise]);

  const exercise = block?.exercises[exerciseIndex] ?? null;
  const filteredPoints = useMemo(() => (exercise ? filterPointsByPeriod(exercise.points, period) : []), [exercise, period]);

  if (isLoading) {
    return <Card title="Cargando progreso"><Skeleton lines={5} /></Card>;
  }

  if (noPlan || blocks.length === 0) {
    return (
      <EmptyState
        title="No hay plan cargado"
        description="El admin debe importar y asignarte un plan."
        action={<Link href="/progress" className="inline-flex text-sm font-semibold text-[var(--primary-end)]">Volver a Progreso</Link>}
      />
    );
  }

  if (!block) {
    return <EmptyState title="Bloque no encontrado" description="No hay datos para este bloque." action={<Link href="/progress" className="inline-flex text-sm font-semibold text-[var(--primary-end)]">Volver a Progreso</Link>} />;
  }

  if (!exercise) {
    return <Card title={`Progreso ${block.blockFullLabel}`}><p className="text-sm text-[var(--muted)]">No hay ejercicios en este bloque.</p></Card>;
  }

  const reversedPoints = filteredPoints.slice().reverse();
  const monthlyImprovementKg = (() => {
    if (exercise.points.length < 2) return null;
    const latest = exercise.points[exercise.points.length - 1];
    const monthBack = parseIsoDate(latest.isoDate);
    monthBack.setDate(monthBack.getDate() - 30);
    const reference = [...exercise.points].reverse().find((point) => parseIsoDate(point.isoDate) <= monthBack);
    if (!reference) return null;
    return latest.weightKg - reference.weightKg;
  })();

  return (
    <div className="space-y-4">
      <section className="rounded-[18px] border border-[color:color-mix(in_oklab,var(--primary-end)_48%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_80%,var(--primary-end)_20%)] p-4 shadow-[0_14px_28px_rgba(108,93,211,0.16)] animate-card">
        <div className="flex items-center justify-between gap-3">
          <Link href="/progress" className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--progress-chip-bg)] text-[var(--progress-chip-fg)]" aria-label="Volver">{"<"}</Link>
          <h2 className="text-base font-semibold text-[var(--foreground)]">Progreso</h2>
          <span className="h-8 w-8" />
        </div>
        <div className="mt-2">
          <select value={block.blockId} onChange={(event) => router.push(`/progress/${event.target.value}?exercise=${exerciseIndex}`)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--progress-chip-bg)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]">
            {blocks.map((item) => (
              <option key={item.blockId} value={item.blockId}>{item.blockFullLabel}</option>
            ))}
          </select>
        </div>
      </section>

      <Card title={`Progreso de ${exercise.exerciseName}`}>
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-1 text-xs font-semibold">
          <button type="button" onClick={() => setPeriod("week")} className={["rounded-lg px-2 py-1.5", period === "week" ? "bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] text-white" : "bg-[var(--progress-chip-muted-bg)] text-[var(--progress-chip-muted-fg)]"].join(" ")}>Semana</button>
          <button type="button" onClick={() => setPeriod("month")} className={["rounded-lg px-2 py-1.5", period === "month" ? "bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] text-white" : "bg-[var(--progress-chip-muted-bg)] text-[var(--progress-chip-muted-fg)]"].join(" ")}>Mes</button>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Semanal</p>
            <p className={["text-2xl font-bold", toneFromDelta(exercise.weeklyDeltaPct)].join(" ")}>{formatDelta(exercise.weeklyDeltaPct)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Mensual</p>
            <p className={["text-2xl font-bold", toneFromDelta(exercise.monthlyDeltaPct)].join(" ")}>{formatDelta(exercise.monthlyDeltaPct)}</p>
          </div>
        </div>

        <MainChart points={filteredPoints} period={period} />

        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2 text-center">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {monthlyImprovementKg === null ? "Sin referencia mensual suficiente" : `${monthlyImprovementKg > 0 ? "+" : ""}${monthlyImprovementKg.toFixed(1)} kg de mejora este mes`}
          </p>
        </div>
      </Card>

      <Card title="Historial reciente">
        <ul className="space-y-2 text-sm">
          {reversedPoints.length === 0 ? <li className="text-[var(--muted)]">Sin registros para este periodo.</li> : reversedPoints.slice(0, 8).map((point, idx) => {
            const prev = reversedPoints[idx + 1];
            const delta = prev ? point.weightKg - prev.weightKg : null;
            return (
              <li key={`${point.isoDate}-${idx}`} className="rounded-lg border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--foreground)]">{formatDateDDMMYYYY(point.isoDate)}</span>
                  <span className="font-semibold text-[var(--foreground)]">{point.weightKg} kg</span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{delta === null ? "Primer registro" : `Cambio vs anterior: ${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`}</p>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
