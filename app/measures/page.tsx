"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import { useAuth } from "@/hooks/useAuth";
import { hydrateMeasuresHybrid, saveMeasureWeekHybrid } from "@/lib/adapters/hybrid";
import { formatDateDDMMYYYY, getLocalISODate } from "@/lib/date";
import { loadMeasuresV1 } from "@/lib/storage";
import type { MeasuresV1 } from "@/lib/types";

type MetricKey = "weightKg" | "neckCm" | "armCm" | "waistCm" | "abdomenCm" | "hipCm" | "thighCm";

type MetricDef = {
  key: MetricKey;
  label: string;
  shortLabel: string;
  unit: "kg" | "cm";
};

const METRICS: MetricDef[] = [
  { key: "weightKg", label: "PESO", shortLabel: "Peso corporal", unit: "kg" },
  { key: "neckCm", label: "CUELLO", shortLabel: "Cuello", unit: "cm" },
  { key: "armCm", label: "BRAZO", shortLabel: "Brazo", unit: "cm" },
  { key: "waistCm", label: "CINTURA", shortLabel: "Cintura", unit: "cm" },
  { key: "abdomenCm", label: "ABDOMEN", shortLabel: "Abdomen", unit: "cm" },
  { key: "hipCm", label: "CADERA", shortLabel: "Cadera", unit: "cm" },
  { key: "thighCm", label: "MUSLO", shortLabel: "Muslo", unit: "cm" },
];

type Point = { weekIso: string; value: number };
type QuickField = {
  key: Exclude<MetricKey, "weightKg">;
  label: string;
};

const QUICK_FIELDS: QuickField[] = [
  { key: "neckCm", label: "Cuello" },
  { key: "armCm", label: "Brazo" },
  { key: "waistCm", label: "Cintura" },
  { key: "abdomenCm", label: "Abdomen" },
  { key: "hipCm", label: "Cadera" },
  { key: "thighCm", label: "Muslo" },
];
// Cambia este valor cuando reemplaces el archivo para invalidar cache del avatar.
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

function baselineForMetric(metric: MetricKey): number {
  if (metric === "weightKg") return 78;
  if (metric === "neckCm") return 38;
  if (metric === "armCm") return 34;
  if (metric === "waistCm") return 84;
  if (metric === "abdomenCm") return 86;
  if (metric === "hipCm") return 97;
  return 56;
}

function buildMockPoints(metric: MetricKey, realPoints: Point[], weeks = 12): Point[] {
  const last = realPoints[realPoints.length - 1];
  const baseValue = last?.value ?? baselineForMetric(metric);
  const endWeek = getWeekStartIso(last?.weekIso ?? getLocalISODate());
  const generated: Point[] = [];

  for (let idx = weeks - 1; idx >= 0; idx -= 1) {
    const weekIso = addDays(endWeek, -idx * 7);
    const progress = weeks - 1 - idx;
    const trend = progress * 0.35;
    const wobble = ((progress % 3) - 1) * 0.15;
    generated.push({
      weekIso,
      value: Number((baseValue - trend + wobble).toFixed(1)),
    });
  }
  return generated;
}

function getLatestMetricValue(
  byWeek: MeasuresV1["byWeek"],
  metric: MetricKey,
): number | null {
  const aliases: Record<MetricKey, string[]> = {
    weightKg: ["weightKg", "weight", "peso"],
    neckCm: ["neckCm", "neck", "cuello"],
    armCm: ["armCm", "arm", "brazo", "biceps"],
    waistCm: ["waistCm", "waist", "cintura"],
    abdomenCm: ["abdomenCm", "abdomen", "abdominal"],
    hipCm: ["hipCm", "hip", "hips", "cadera"],
    thighCm: ["thighCm", "thigh", "muslo"],
  };
  const orderedWeeks = Object.keys(byWeek).sort((a, b) => a.localeCompare(b));
  for (let idx = orderedWeeks.length - 1; idx >= 0; idx -= 1) {
    const week = orderedWeeks[idx];
    const row = byWeek[week] as Record<string, unknown> | undefined;
    if (!row) continue;
    for (const key of aliases[metric]) {
      const raw = row[key];
      if (typeof raw === "number" && Number.isFinite(raw)) {
        return raw;
      }
      if (typeof raw === "string") {
        const parsed = Number(raw.replace(",", "."));
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  }
  return null;
}

function MuscleAvatar({ className = "" }: { className?: string }) {
  const [frontImageLoaded, setFrontImageLoaded] = useState(false);

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)]",
        className,
      ].join(" ")}
    >
      {!frontImageLoaded ? (
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-[var(--muted)]">
          <p>
            Sube <code>/public/body-front-muscles.png</code> para ver el avatar.
          </p>
        </div>
      ) : null}
      <Image
        src={BODY_IMAGE_FRONT}
        alt="Avatar muscular frontal"
        fill
        sizes="(max-width: 768px) 45vw, 320px"
        className="object-contain [object-position:center_center] scale-[1.45]"
        onLoad={() => setFrontImageLoaded(true)}
        onError={() => setFrontImageLoaded(false)}
      />
    </div>
  );
}

function MiniLineChart({ points, unit }: { points: Point[]; unit: string }) {
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Sin historial todavia.</p>;
  }

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

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full">
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
              x={Math.max(8, chartPoints[selectedPointIndex].x - 30)}
              y={Math.max(4, chartPoints[selectedPointIndex].y - 24)}
              width="60"
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
              {points[selectedPointIndex].value} {unit}
            </text>
          </g>
        ) : null}
      </svg>
      <div className="mt-1 flex items-center justify-between text-[11px] text-[var(--muted)]">
        <span>Semana 1</span>
        <span className="font-semibold text-[var(--foreground)]">
          {points[points.length - 1].value} {unit}
        </span>
        <span>Semana {points.length}</span>
      </div>
    </div>
  );
}

export default function MeasuresPage() {
  const { user } = useAuth();
  const mockEnabled = (user?.email ?? "").trim().toLowerCase() === "mock";
  const [measures, setMeasures] = useState<MeasuresV1>(() => loadMeasuresV1());
  const [activeMetric, setActiveMetric] = useState<MetricKey>("weightKg");
  const [quickWeekIso, setQuickWeekIso] = useState(getWeekStartIso(getLocalISODate()));
  const [quickWeight, setQuickWeight] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);
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
      const hydrated = await hydrateMeasuresHybrid();
      setMeasures(hydrated);
    })();
  }, []);

  const metricDef = METRICS.find((m) => m.key === activeMetric) ?? METRICS[0];
  const activeMetricIndex = Math.max(
    0,
    METRICS.findIndex((metric) => metric.key === activeMetric),
  );

  const realPoints = useMemo(() => {
    return Object.entries(measures.byWeek)
      .map(([weekIso, row]) => {
        const value = row[activeMetric];
        return typeof value === "number" ? { weekIso, value } : null;
      })
      .filter((row): row is Point => row !== null)
      .sort((a, b) => a.weekIso.localeCompare(b.weekIso));
  }, [measures.byWeek, activeMetric]);

  const points = useMemo(
    () => (mockEnabled ? buildMockPoints(activeMetric, realPoints, 12) : realPoints),
    [activeMetric, mockEnabled, realPoints],
  );

  const weeklyDelta = useMemo(() => getDelta(points, 7), [points]);
  const monthlyDelta = useMemo(() => getDelta(points, 28), [points]);
  const weightRealPoints = useMemo(() => {
    return Object.entries(measures.byWeek)
      .map(([weekIso, row]) => {
        const value = row.weightKg;
        return typeof value === "number" ? { weekIso, value } : null;
      })
      .filter((row): row is Point => row !== null)
      .sort((a, b) => a.weekIso.localeCompare(b.weekIso));
  }, [measures.byWeek]);
  const weightPoints = useMemo(
    () => (mockEnabled ? buildMockPoints("weightKg", weightRealPoints, 12) : weightRealPoints),
    [mockEnabled, weightRealPoints],
  );
  const currentWeight = weightPoints.length > 0 ? weightPoints[weightPoints.length - 1].value : null;
  const weightWeeklyDelta = useMemo(() => getDelta(weightPoints, 7), [weightPoints]);
  const weightMonthlyDelta = useMemo(() => getDelta(weightPoints, 28), [weightPoints]);

  const historyRows = useMemo(() => {
    return points
      .slice()
      .reverse()
      .map((point, idx, arr) => {
        const prev = arr[idx + 1];
        const delta = prev ? point.value - prev.value : null;
        return {
          weekIso: point.weekIso,
          value: point.value,
          delta,
        };
      });
  }, [points]);
  const visibleHistoryRows = showAllHistory ? historyRows : historyRows.slice(0, 4);
  const hasMoreHistory = historyRows.length > 4;

  const latestQuickValues = useMemo(() => {
    const metricPoints = (metric: MetricKey): Point[] => {
      return Object.entries(measures.byWeek)
        .map(([weekIso, row]) => {
          const value = row[metric];
          return typeof value === "number" ? { weekIso, value } : null;
        })
        .filter((row): row is Point => row !== null)
        .sort((a, b) => a.weekIso.localeCompare(b.weekIso));
    };

    const withMockFallback = (metric: MetricKey): number | null => {
      const real = getLatestMetricValue(measures.byWeek, metric);
      if (real !== null) return real;
      if (!mockEnabled) return null;
      const mocked = buildMockPoints(metric, metricPoints(metric), 12);
      const last = mocked[mocked.length - 1];
      return last?.value ?? null;
    };

    return {
      neckCm: withMockFallback("neckCm"),
      armCm: withMockFallback("armCm"),
      waistCm: withMockFallback("waistCm"),
      abdomenCm: withMockFallback("abdomenCm"),
      hipCm: withMockFallback("hipCm"),
      thighCm: withMockFallback("thighCm"),
    };
  }, [measures.byWeek, mockEnabled]);
  const latestWeightValue = useMemo(
    () => {
      const real = getLatestMetricValue(measures.byWeek, "weightKg");
      if (real !== null) return real;
      if (currentWeight !== null) return currentWeight;
      if (!mockEnabled) return null;
      const mocked = buildMockPoints("weightKg", weightRealPoints, 12);
      return mocked[mocked.length - 1]?.value ?? null;
    },
    [currentWeight, measures.byWeek, mockEnabled, weightRealPoints],
  );

  useEffect(() => {
    const row = measures.byWeek[quickWeekIso];
    setQuickWeight(row?.weightKg !== undefined ? String(row.weightKg) : "");
    setQuickValues({
      neckCm: row?.neckCm !== undefined ? String(row.neckCm) : "",
      armCm: row?.armCm !== undefined ? String(row.armCm) : "",
      waistCm: row?.waistCm !== undefined ? String(row.waistCm) : "",
      abdomenCm:
        row?.abdomenCm !== undefined
          ? String(row.abdomenCm)
          : "",
      hipCm: row?.hipCm !== undefined ? String(row.hipCm) : "",
      thighCm:
        row?.thighCm !== undefined
          ? String(row.thighCm)
          : "",
    });
  }, [measures, quickWeekIso]);

  function saveQuickMeasures() {
    const patch: Partial<Record<MetricKey, number>> = {};
    const parsedWeight = Number(quickWeight.replace(",", "."));
    if (quickWeight.trim() && Number.isFinite(parsedWeight)) {
      patch.weightKg = Number(parsedWeight.toFixed(1));
    }
    for (const field of QUICK_FIELDS) {
      const raw = quickValues[field.key].trim();
      if (!raw) continue;
      const parsed = Number(raw.replace(",", "."));
      if (Number.isFinite(parsed)) {
        patch[field.key] = Number(parsed.toFixed(1));
      }
    }
    if (Object.keys(patch).length === 0) return;

    const next: MeasuresV1 = {
      ...measures,
      byWeek: {
        ...measures.byWeek,
        [quickWeekIso]: {
          ...(measures.byWeek[quickWeekIso] ?? {}),
          ...patch,
          updatedAtISO: new Date().toISOString(),
        },
      },
    };
    setMeasures(next);
    void saveMeasureWeekHybrid(quickWeekIso, next.byWeek[quickWeekIso]);
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="space-y-4">
          <div>
            <p className="text-5xl font-bold text-[var(--foreground)]">
              {currentWeight !== null ? `${currentWeight} kg` : "--"}
            </p>
            <p className={["mt-1 text-2xl font-semibold", toneClass(weightWeeklyDelta)].join(" ")}>
              {formatSigned(weightWeeklyDelta, "kg")} esta semana
            </p>
            <p className={["mt-1 text-xl font-semibold", toneClass(weightMonthlyDelta)].join(" ")}>
              {formatSigned(weightMonthlyDelta, "kg")} este mes
            </p>
          </div>
          <div className="grid grid-cols-[1fr_45%] gap-3">
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Semana de registro
                </span>
                <input
                  type="date"
                  value={quickWeekIso}
                  onChange={(event) => setQuickWeekIso(getWeekStartIso(event.target.value))}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
                />
              </label>
              <label className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Peso (kg)
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quickWeight}
                  onChange={(event) => setQuickWeight(event.target.value)}
                  placeholder={latestWeightValue !== null ? String(latestWeightValue) : ""}
                  className="mt-1 w-full rounded-xl bg-transparent px-2 py-1 text-base font-semibold text-[var(--foreground)] outline-none placeholder:font-normal placeholder:text-[var(--muted)] placeholder:opacity-55 focus:ring-2 focus:ring-[var(--primary-end)]"
                />
              </label>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_45%] gap-3 items-stretch">
            <div className="space-y-2">
              {QUICK_FIELDS.map((field) => (
                <label key={field.key} className="block rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {field.label}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={quickValues[field.key]}
                    onChange={(event) =>
                      setQuickValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                    placeholder={latestQuickValues[field.key] !== null ? String(latestQuickValues[field.key]) : ""}
                    className="mt-1 w-full rounded-xl bg-transparent px-2 py-1 text-base font-semibold text-[var(--foreground)] outline-none placeholder:font-normal placeholder:text-[var(--muted)] placeholder:opacity-55 focus:ring-2 focus:ring-[var(--primary-end)]"
                  />
                </label>
              ))}
            </div>
            <div className="h-full">
              <MuscleAvatar className="h-full min-h-[18rem]" />
            </div>
          </div>
          <button
            type="button"
            onClick={saveQuickMeasures}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white"
          >
            Guardar medidas
          </button>
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-1.5">
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--muted)]"
              aria-label="Medida anterior"
              onClick={() =>
                setActiveMetric(
                  METRICS[(activeMetricIndex - 1 + METRICS.length) % METRICS.length].key,
                )
              }
            >
              {"<"}
            </button>
            <div className="flex-1 rounded-lg bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-1.5 text-center text-xs font-semibold text-white">
              {metricDef.label}
            </div>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--muted)]"
              aria-label="Medida siguiente"
              onClick={() => setActiveMetric(METRICS[(activeMetricIndex + 1) % METRICS.length].key)}
            >
              {">"}
            </button>
          </div>
          <div>
            <p className="text-4xl font-bold text-[var(--foreground)]">
              {points.length > 0 ? `${points[points.length - 1].value} ${metricDef.unit}` : "--"}
            </p>
            <p className={["mt-1 text-lg font-semibold", toneClass(weeklyDelta)].join(" ")}>
              {formatSigned(weeklyDelta, metricDef.unit)} esta semana
            </p>
            <p className={["mt-1 text-base font-semibold", toneClass(monthlyDelta)].join(" ")}>
              {formatSigned(monthlyDelta, metricDef.unit)} este mes
            </p>
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
          <>
            <ul className="space-y-2">
              {visibleHistoryRows.map((row) => (
              <li key={row.weekIso} className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    Semana del {formatDateDDMMYYYY(row.weekIso)} al {formatDateDDMMYYYY(addDays(row.weekIso, 6))}
                  </p>
                  <p className={["text-sm font-semibold", toneClass(row.delta)].join(" ")}>
                    {formatSigned(row.delta, metricDef.unit)}
                  </p>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {row.value} {metricDef.unit}
                </p>
              </li>
              ))}
            </ul>
            {hasMoreHistory ? (
              <button
                type="button"
                onClick={() => setShowAllHistory((prev) => !prev)}
                className="mt-3 text-sm font-semibold text-[var(--primary-end)]"
              >
                {showAllHistory ? "Ver menos" : `Ver ${historyRows.length - 4} mas`}
              </button>
            ) : null}
          </>
        )}
      </Card>

    </div>
  );
}
