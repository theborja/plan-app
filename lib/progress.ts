import { resolveTrainingDay } from "@/lib/planResolver";
import type { PlanV1, SelectionsV1, SettingsV1 } from "@/lib/types";

export type ProgressPoint = {
  isoDate: string;
  weightKg: number;
};

export type ExerciseProgress = {
  exerciseIndex: number;
  exerciseName: string;
  points: ProgressPoint[];
  weeklyDeltaPct: number | null;
  monthlyDeltaPct: number | null;
  weeklyDeltaKg: number | null;
  monthlyDeltaKg: number | null;
};

export type BlockProgress = {
  blockId: string;
  blockTabLabel: string;
  blockName: string;
  blockFullLabel: string;
  exercises: ExerciseProgress[];
  weeklyAvgPct: number | null;
  monthlyAvgPct: number | null;
  weeklyTotalKg: number | null;
  monthlyTotalKg: number | null;
};

function parseIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function cleanBlockName(label: string): string {
  return label.replace(/^D[ÍI]A\s*\d+\s*[-:]\s*/i, "").trim() || label.trim();
}

function buildBlockFullLabel(dayIndex: number, label: string): string {
  const normalized = label.trim();
  if (!normalized) {
    return `Dia ${dayIndex}`;
  }

  if (/^D[ÍI]A\s*\d+/i.test(normalized)) {
    return normalized;
  }

  return `Dia ${dayIndex} - ${normalized}`;
}

function extractFirstNumber(text: string): number | null {
  const match = text.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSeriesWeights(raw: string): number[] {
  if (!raw.trim()) return [];
  const normalized = raw.includes("||") ? raw : raw.replace(/\.\./g, "|");
  return normalized
    .split("|")
    .map((part) => part.trim())
    .map(extractFirstNumber)
    .filter((value): value is number => value !== null);
}

function getRepresentativeWeight(raw: string): number | null {
  const values = parseSeriesWeights(raw);
  if (values.length === 0) return null;
  return Math.max(...values);
}

function computeDeltaFromDays(points: ProgressPoint[], daysBack: number): { pct: number | null; kg: number | null } {
  if (points.length < 2) return { pct: null, kg: null };
  const latest = points[points.length - 1];
  const latestDate = parseIsoDate(latest.isoDate);
  const threshold = new Date(latestDate);
  threshold.setDate(threshold.getDate() - daysBack);

  let reference: ProgressPoint | null = null;
  for (let idx = points.length - 2; idx >= 0; idx -= 1) {
    const point = points[idx];
    const pointDate = parseIsoDate(point.isoDate);
    if (pointDate <= threshold) {
      reference = point;
      break;
    }
  }

  if (!reference) return { pct: null, kg: null };

  const kg = latest.weightKg - reference.weightKg;
  if (reference.weightKg === 0) {
    return { pct: null, kg: round1(kg) };
  }

  const pct = (kg / reference.weightKg) * 100;
  return { pct: round1(pct), kg: round1(kg) };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((acc, value) => acc + value, 0);
  return round1(total / values.length);
}

function sum(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((acc, value) => acc + value, 0));
}

export function buildProgressBlocks(
  plan: PlanV1,
  selections: SelectionsV1,
  settings: SettingsV1,
): BlockProgress[] {
  const dates = Object.keys(selections.byDate).sort();

  return plan.training.days.map((day, blockIndex) => {
    const blockId = `block-${day.dayIndex}-${blockIndex}`;
    const blockTabLabel = `Dia ${day.dayIndex}`;
    const blockName = cleanBlockName(day.label);
    const blockFullLabel = buildBlockFullLabel(day.dayIndex, day.label);

    const exercises = day.exercises.map((exercise, exerciseIndex) => {
      const points: ProgressPoint[] = [];

      for (const isoDate of dates) {
        const daily = selections.byDate[isoDate];
        if (!daily?.workout) continue;

        const resolved = resolveTrainingDay(plan, isoDate, settings);
        if (!resolved || resolved.dayIndex !== day.dayIndex) continue;

        const rawWeight = daily.workout.lastWeightByExerciseIndex?.[String(exerciseIndex)] ?? "";
        const representative = getRepresentativeWeight(rawWeight);
        if (representative === null) continue;

        points.push({
          isoDate,
          weightKg: representative,
        });
      }

      const weekly = computeDeltaFromDays(points, 7);
      const monthly = computeDeltaFromDays(points, 30);

      return {
        exerciseIndex,
        exerciseName: exercise.name,
        points,
        weeklyDeltaPct: weekly.pct,
        monthlyDeltaPct: monthly.pct,
        weeklyDeltaKg: weekly.kg,
        monthlyDeltaKg: monthly.kg,
      };
    });

    const weeklyPcts = exercises
      .map((exercise) => exercise.weeklyDeltaPct)
      .filter((value): value is number => value !== null);
    const monthlyPcts = exercises
      .map((exercise) => exercise.monthlyDeltaPct)
      .filter((value): value is number => value !== null);
    const weeklyKgs = exercises
      .map((exercise) => exercise.weeklyDeltaKg)
      .filter((value): value is number => value !== null);
    const monthlyKgs = exercises
      .map((exercise) => exercise.monthlyDeltaKg)
      .filter((value): value is number => value !== null);

    return {
      blockId,
      blockTabLabel,
      blockName,
      blockFullLabel,
      exercises,
      weeklyAvgPct: average(weeklyPcts),
      monthlyAvgPct: average(monthlyPcts),
      weeklyTotalKg: sum(weeklyKgs),
      monthlyTotalKg: sum(monthlyKgs),
    };
  });
}
