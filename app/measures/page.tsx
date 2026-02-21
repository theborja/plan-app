"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import NoPlanState from "@/components/NoPlanState";
import { fetchJson, postJson } from "@/lib/clientApi";
import { formatDateDDMMYYYY, getLocalISODate } from "@/lib/date";

type MetricKey = "weightKg" | "neckCm" | "armCm" | "waistCm" | "abdomenCm" | "hipCm" | "thighCm";
type Row = {
  weekStartISO: string;
  weightKg: number | null;
  neckCm: number | null;
  armCm: number | null;
  waistCm: number | null;
  abdomenCm: number | null;
  hipCm: number | null;
  thighCm: number | null;
};

type Point = { weekIso: string; value: number };

const METRICS: Array<{ key: MetricKey; label: string; shortLabel: string; unit: "kg" | "cm" }> = [
  { key: "weightKg", label: "PESO", shortLabel: "Peso corporal", unit: "kg" },
  { key: "neckCm", label: "CUELLO", shortLabel: "Cuello", unit: "cm" },
  { key: "armCm", label: "BRAZO", shortLabel: "Brazo", unit: "cm" },
  { key: "waistCm", label: "CINTURA", shortLabel: "Cintura", unit: "cm" },
  { key: "abdomenCm", label: "ABDOMEN", shortLabel: "Abdomen", unit: "cm" },
  { key: "hipCm", label: "CADERA", shortLabel: "Cadera", unit: "cm" },
  { key: "thighCm", label: "MUSLO", shortLabel: "Muslo", unit: "cm" },
];

const QUICK_FIELDS: Array<{ key: Exclude<MetricKey, "weightKg">; label: string }> = [
  { key: "neckCm", label: "Cuello" },
  { key: "armCm", label: "Brazo" },
  { key: "waistCm", label: "Cintura" },
  { key: "abdomenCm", label: "Abdomen" },
  { key: "hipCm", label: "Cadera" },
  { key: "thighCm", label: "Muslo" },
];

const BODY_IMAGE_FRONT = "/body-front-muscles.png?v=2";

function parseIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekStartIso(isoDate: string): string {
  const date = parseIsoDate(isoDate);
  const day = date.getDay();
  const offsetToMonday = (day + 6) % 7;
  date.setDate(date.getDate() - offsetToMonday);
  return toIsoDate(date);
}

function addDays(isoDate: string, amount: number): string {
  const date = parseIsoDate(isoDate);
  date.setDate(date.getDate() + amount);
  return toIsoDate(date);
}

function formatSigned(value: number | null, unit: string): string {
  if (value === null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} ${unit}`;
}

function toneClass(value: number | null): string {
  if (value === null) return "text-[var(--muted)]";
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-[var(--muted)]";
}

function getDelta(points: Point[], daysBack: number): number | null {
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const threshold = parseIsoDate(latest.weekIso);
  threshold.setDate(threshold.getDate() - daysBack);

  let reference: Point | null = null;
  for (let idx = points.length - 2; idx >= 0; idx -= 1) {
    const point = points[idx];
    if (parseIsoDate(point.weekIso) <= threshold) {
      reference = point;
      break;
    }
  }

  if (!reference) return null;
  return latest.value - reference.value;
}

function MuscleAvatar({ className = "" }: { className?: string }) {
  return (
    <div className={["relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]", className].join(" ")}>
      <Image src={BODY_IMAGE_FRONT} alt="Avatar muscular frontal" fill sizes="(max-width: 768px) 45vw, 320px" className="object-contain [object-position:center_center] scale-[1.45]" />
    </div>
  );
}

function MiniLineChart({ points, unit }: { points: Point[]; unit: string }) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  if (points.length === 0) return <p className="text-sm text-[var(--muted)]">Sin historial todavia.</p>;

  const width = 320;
  const height = 140;
  const padding = 16;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const chartPoints = points.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
    const y = height - padding - ((point.value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const polyline = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const latestValue = points[points.length - 1].value;
  const footerValue =
    selectedPointIndex !== null ? points[selectedPointIndex].value : latestValue;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full"
        onClick={() => setSelectedPointIndex(null)}
      >
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
              onClick={(event) => {
                event.stopPropagation();
                setSelectedPointIndex((prev) => (prev === idx ? null : idx));
              }}
            />
          </g>
        ))}
        {selectedPointIndex !== null ? (
          <g>
            <rect
              x={Math.max(8, chartPoints[selectedPointIndex].x - 34)}
              y={Math.max(4, chartPoints[selectedPointIndex].y - 28)}
              width="68"
              height="16"
              rx="8"
              fill="var(--surface)"
              stroke="var(--border)"
            />
            <text
              x={chartPoints[selectedPointIndex].x}
              y={Math.max(15, chartPoints[selectedPointIndex].y - 16)}
              fontSize="9"
              textAnchor="middle"
              fill="var(--foreground)"
              className="font-semibold"
            >
              {points[selectedPointIndex].value} {unit}
            </text>
          </g>
        ) : null}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--muted)]">
        <span>Semana 1</span>
        <span className="font-semibold text-[var(--foreground)]">{footerValue} {unit}</span>
        <span>Semana {points.length}</span>
      </div>
      {selectedPointIndex !== null ? (
        <p className="mt-1 text-center text-[11px] text-[var(--muted)]">
          Semana del {formatDateDDMMYYYY(points[selectedPointIndex].weekIso)}
        </p>
      ) : null}
    </div>
  );
}

export default function MeasuresPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [noPlan, setNoPlan] = useState(false);
  const [activeMetric, setActiveMetric] = useState<MetricKey>("weightKg");
  const [quickWeekIso, setQuickWeekIso] = useState(getWeekStartIso(getLocalISODate()));
  const [quickWeight, setQuickWeight] = useState("");
  const [quickValues, setQuickValues] = useState<Record<Exclude<MetricKey, "weightKg">, string>>({
    neckCm: "",
    armCm: "",
    waistCm: "",
    abdomenCm: "",
    hipCm: "",
    thighCm: "",
  });

  useEffect(() => {
    void (async () => {
      const [measuresData, planData] = await Promise.all([
        fetchJson<{ ok: true; rows: Row[] }>("/api/measures/week"),
        fetchJson<{ ok: true; plan: { id: string } | null }>("/api/plans/active"),
      ]);
      setRows(measuresData.rows);
      setNoPlan(!planData.plan);
    })();
  }, []);

  useEffect(() => {
    const row = rows.find((item) => item.weekStartISO === quickWeekIso);
    setQuickWeight(row?.weightKg != null ? String(row.weightKg) : "");
    setQuickValues({
      neckCm: row?.neckCm != null ? String(row.neckCm) : "",
      armCm: row?.armCm != null ? String(row.armCm) : "",
      waistCm: row?.waistCm != null ? String(row.waistCm) : "",
      abdomenCm: row?.abdomenCm != null ? String(row.abdomenCm) : "",
      hipCm: row?.hipCm != null ? String(row.hipCm) : "",
      thighCm: row?.thighCm != null ? String(row.thighCm) : "",
    });
  }, [rows, quickWeekIso]);

  const metricDef = METRICS.find((item) => item.key === activeMetric) ?? METRICS[0];
  const activeMetricIndex = Math.max(0, METRICS.findIndex((item) => item.key === activeMetric));

  const points = useMemo(() => {
    return rows
      .map((row) => {
        const value = row[activeMetric];
        return typeof value === "number" ? { weekIso: row.weekStartISO, value } : null;
      })
      .filter((item): item is Point => item !== null)
      .sort((a, b) => a.weekIso.localeCompare(b.weekIso));
  }, [rows, activeMetric]);

  const weightPoints = useMemo(() => {
    return rows
      .map((row) => (typeof row.weightKg === "number" ? { weekIso: row.weekStartISO, value: row.weightKg } : null))
      .filter((item): item is Point => item !== null)
      .sort((a, b) => a.weekIso.localeCompare(b.weekIso));
  }, [rows]);

  const currentWeight = weightPoints.length > 0 ? weightPoints[weightPoints.length - 1].value : null;
  const weightWeeklyDelta = useMemo(() => getDelta(weightPoints, 7), [weightPoints]);
  const weightMonthlyDelta = useMemo(() => getDelta(weightPoints, 28), [weightPoints]);
  const weeklyDelta = useMemo(() => getDelta(points, 7), [points]);
  const monthlyDelta = useMemo(() => getDelta(points, 28), [points]);

  async function saveQuickMeasures() {
    const payload: Record<string, unknown> = { weekStartISO: quickWeekIso };

    const parsedWeight = Number(quickWeight.replace(",", "."));
    if (quickWeight.trim() && Number.isFinite(parsedWeight)) payload.weightKg = Number(parsedWeight.toFixed(1));

    for (const field of QUICK_FIELDS) {
      const raw = quickValues[field.key].trim();
      if (!raw) continue;
      const parsed = Number(raw.replace(",", "."));
      if (Number.isFinite(parsed)) payload[field.key] = Number(parsed.toFixed(1));
    }

    const saved = await postJson<{ ok: true; row: Row }>("/api/measures/week", payload);
    setRows((prev) => {
      const idx = prev.findIndex((item) => item.weekStartISO === saved.row.weekStartISO);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved.row;
        return next;
      }
      return [...prev, saved.row].sort((a, b) => a.weekStartISO.localeCompare(b.weekStartISO));
    });
  }

  const historyRows = points.slice().reverse().map((point, idx, arr) => {
    const prev = arr[idx + 1];
    return { weekIso: point.weekIso, value: point.value, delta: prev ? point.value - prev.value : null };
  });

  if (noPlan) {
    return <NoPlanState />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-4">
          <div>
            <p className="text-5xl font-bold text-[var(--foreground)]">{currentWeight !== null ? `${currentWeight} kg` : "--"}</p>
            <p className={["mt-1 text-2xl font-semibold", toneClass(weightWeeklyDelta)].join(" ")}>{formatSigned(weightWeeklyDelta, "kg")} esta semana</p>
            <p className={["mt-1 text-xl font-semibold", toneClass(weightMonthlyDelta)].join(" ")}>{formatSigned(weightMonthlyDelta, "kg")} este mes</p>
          </div>
          <div className="grid grid-cols-[1fr_45%] gap-3">
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Semana de registro</span>
                <input type="date" value={quickWeekIso} onChange={(event) => setQuickWeekIso(getWeekStartIso(event.target.value))} className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
              </label>
              <label className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Peso (kg)</span>
                <input type="text" inputMode="decimal" value={quickWeight} onChange={(event) => setQuickWeight(event.target.value)} className="mt-1 w-full rounded-xl bg-transparent px-2 py-1 text-base font-semibold outline-none" />
              </label>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_45%] gap-3 items-stretch">
            <div className="space-y-2">
              {QUICK_FIELDS.map((field) => (
                <label key={field.key} className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{field.label}</span>
                  <input type="text" inputMode="decimal" value={quickValues[field.key]} onChange={(event) => setQuickValues((prev) => ({ ...prev, [field.key]: event.target.value }))} className="mt-1 w-full rounded-xl bg-transparent px-2 py-1 text-base font-semibold outline-none" />
                </label>
              ))}
            </div>
            <div className="h-full">
              <MuscleAvatar className="h-full min-h-[18rem]" />
            </div>
          </div>
          <button type="button" onClick={() => void saveQuickMeasures()} className="w-full rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white">Guardar medidas</button>
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-1.5">
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface)]" onClick={() => setActiveMetric(METRICS[(activeMetricIndex - 1 + METRICS.length) % METRICS.length].key)}>{"<"}</button>
            <div className="flex-1 rounded-lg bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-1.5 text-center text-xs font-semibold text-white">{metricDef.label}</div>
            <button type="button" className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface)]" onClick={() => setActiveMetric(METRICS[(activeMetricIndex + 1) % METRICS.length].key)}>{">"}</button>
          </div>
          <div>
            <p className="text-4xl font-bold text-[var(--foreground)]">{points.length > 0 ? `${points[points.length - 1].value} ${metricDef.unit}` : "--"}</p>
            <p className={["mt-1 text-lg font-semibold", toneClass(weeklyDelta)].join(" ")}>{formatSigned(weeklyDelta, metricDef.unit)} esta semana</p>
            <p className={["mt-1 text-base font-semibold", toneClass(monthlyDelta)].join(" ")}>{formatSigned(monthlyDelta, metricDef.unit)} este mes</p>
          </div>
        </div>
      </Card>

      <Card title={`Historico de ${metricDef.shortLabel}`}>
        <MiniLineChart points={points.slice(-12)} unit={metricDef.unit} />
      </Card>

      <Card title="Ultimas semanas">
        {historyRows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sin medidas registradas todavia.</p>
        ) : (
          <ul className="space-y-2">
            {historyRows.map((row) => (
              <li key={row.weekIso} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--foreground)]">Semana del {formatDateDDMMYYYY(row.weekIso)} al {formatDateDDMMYYYY(addDays(row.weekIso, 6))}</p>
                  <p className={["text-sm font-semibold", toneClass(row.delta)].join(" ")}>{formatSigned(row.delta, metricDef.unit)}</p>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{row.value} {metricDef.unit}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
