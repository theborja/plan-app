import { apiGet, apiPost } from "@/lib/apiClient";
import { getLocalISODate } from "@/lib/date";
import {
  defaultMeasuresV1,
  defaultSelectionsV1,
  loadMeasuresV1,
  loadPlanV1,
  loadSelectionsV1,
  saveMeasuresV1,
  savePlanV1,
  saveSelectionsV1,
} from "@/lib/storage";
import type { MeasuresV1, PlanV1, SelectionsV1 } from "@/lib/types";

type ActivePlanResponse = {
  ok: boolean;
  activePlan: {
    id: string;
    sourceFileName: string;
    importedAtISO: string;
    planV1: PlanV1;
  } | null;
};

type NutritionDayResponse = {
  ok: boolean;
  nutrition: {
    options: Array<{
      dayOptionIndex: number;
      optionId: string;
      optionLabel: string;
      weekIndex: number;
      dayOfWeek: string;
      meals: Array<{ mealType: string; lines: string[] }>;
    }>;
    selection: {
      selectedDayOptionIndex: number | null;
      done: boolean;
      note: string | null;
      updatedAtISO: string;
    } | null;
    suggestedDayOptionIndex: number | null;
  } | null;
};

type WorkoutDayResponse = {
  ok: boolean;
  workout: {
    trainingDay: {
      id: string;
      dayIndex: number;
      label: string;
      exercises: Array<{
        id: string;
        exerciseIndex: number;
        name: string;
        series: number | null;
        reps: string | null;
        restSeconds: number | null;
        notes: string | null;
      }>;
    } | null;
    session: {
      note: string | null;
      completed: boolean;
      setLogs: Array<{
        exerciseId: string;
        setNumber: number;
        weight: number | null;
      }>;
    } | null;
  } | null;
};

type ProgressBlocksResponse = { ok: boolean; blocks: unknown[] };
type ProgressBlockResponse = { ok: boolean; block: unknown | null };

type MeasuresRowsResponse = {
  ok: boolean;
  rows: Array<{
    weekStartISO: string;
    weightKg: number | null;
    neckCm: number | null;
    armCm: number | null;
    waistCm: number | null;
    abdomenCm: number | null;
    hipCm: number | null;
    thighCm: number | null;
    note: string | null;
    updatedAt: string;
  }>;
};

function hybridEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_DB_MIGRATION_HYBRID;
  if (!raw) return true;
  return raw.toLowerCase() !== "false";
}

export async function getActivePlanHybrid(): Promise<PlanV1 | null> {
  if (!hybridEnabled()) return loadPlanV1();

  try {
    const response = await apiGet<ActivePlanResponse>("/api/plans/active");
    if (!response.activePlan) return loadPlanV1();
    savePlanV1(response.activePlan.planV1);
    return response.activePlan.planV1;
  } catch {
    return loadPlanV1();
  }
}

export async function importPlanHybrid(plan: PlanV1): Promise<boolean> {
  try {
    await apiPost("/api/plans/import", {
      sourceFileName: plan.sourceFileName,
      plan,
    });
    savePlanV1(plan);
    saveSelectionsV1(defaultSelectionsV1());
    return true;
  } catch {
    savePlanV1(plan);
    saveSelectionsV1(defaultSelectionsV1());
    return false;
  }
}

export async function hydrateTodaySelectionHybrid(dateISO: string): Promise<SelectionsV1> {
  const local = loadSelectionsV1();
  if (!hybridEnabled()) return local;

  try {
    const response = await apiGet<NutritionDayResponse>(`/api/nutrition/day?date=${dateISO}`);
    const selection = response.nutrition?.selection;
    if (!selection) return local;

    const day = local.byDate[dateISO] ?? { meals: {} };
    const selectedId =
      typeof selection.selectedDayOptionIndex === "number"
        ? String(selection.selectedDayOptionIndex)
        : day.dailyMenu?.selectedDayOptionId;

    const merged: SelectionsV1 = {
      ...local,
      byDate: {
        ...local.byDate,
        [dateISO]: {
          ...day,
          dailyMenu: {
            ...day.dailyMenu,
            selectedDayOptionId: selectedId,
            done: selection.done,
            note: selection.note ?? "",
            updatedAtISO: selection.updatedAtISO,
          },
        },
      },
    };

    saveSelectionsV1(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function saveTodaySelectionHybrid(input: {
  dateISO: string;
  selectedDayOptionId?: string;
  done?: boolean;
  note?: string;
}): Promise<void> {
  const local = loadSelectionsV1();
  const day = local.byDate[input.dateISO] ?? { meals: {} };
  const merged: SelectionsV1 = {
    ...local,
    byDate: {
      ...local.byDate,
      [input.dateISO]: {
        ...day,
        dailyMenu: {
          ...day.dailyMenu,
          selectedDayOptionId: input.selectedDayOptionId ?? day.dailyMenu?.selectedDayOptionId,
          done: input.done ?? day.dailyMenu?.done,
          note: input.note ?? day.dailyMenu?.note,
          updatedAtISO: new Date().toISOString(),
        },
      },
    },
  };
  saveSelectionsV1(merged);

  if (!hybridEnabled()) return;

  const numericIndex = Number(input.selectedDayOptionId ?? "");
  await apiPost("/api/nutrition/selection", {
    dateISO: input.dateISO,
    selectedDayOptionIndex: Number.isFinite(numericIndex) ? numericIndex : null,
    done: input.done,
    note: input.note,
  }).catch(() => undefined);
}

export async function hydrateWorkoutHybrid(dateISO: string): Promise<SelectionsV1> {
  const local = loadSelectionsV1();
  if (!hybridEnabled()) return local;

  try {
    const response = await apiGet<WorkoutDayResponse>(`/api/workout/day?date=${dateISO}`);
    const workout = response.workout;
    if (!workout?.session) return local;

    const day = local.byDate[dateISO] ?? { meals: {} };
    const exerciseOrder = workout.trainingDay?.exercises ?? [];

    const doneExerciseIndexes: number[] = [];
    const byIndex: Record<string, string> = {};

    for (const exercise of exerciseOrder) {
      const logs = workout.session.setLogs.filter((log) => log.exerciseId === exercise.id);
      const serialized = logs
        .sort((a, b) => a.setNumber - b.setNumber)
        .map((log) => (typeof log.weight === "number" ? String(log.weight) : ""))
        .join("||");
      byIndex[String(exercise.exerciseIndex)] = serialized;
      if (logs.length > 0 && logs.every((log) => typeof log.weight === "number")) {
        doneExerciseIndexes.push(exercise.exerciseIndex);
      }
    }

    const merged: SelectionsV1 = {
      ...local,
      byDate: {
        ...local.byDate,
        [dateISO]: {
          ...day,
          workout: {
            doneExerciseIndexes,
            lastWeightByExerciseIndex: byIndex,
            note: workout.session.note ?? "",
            updatedAtISO: new Date().toISOString(),
          },
        },
      },
    };

    saveSelectionsV1(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function saveWorkoutHybrid(input: {
  dateISO: string;
  trainingDayId?: string;
  exercisesById?: Array<{ exerciseId: string; weights: Array<number | null> }>;
  note?: string;
  completed?: boolean;
}): Promise<void> {
  if (!hybridEnabled()) return;

  await apiPost("/api/workout/session", {
    dateISO: input.dateISO,
    trainingDayId: input.trainingDayId,
    note: input.note ?? "",
    completed: Boolean(input.completed),
  }).catch(() => undefined);

  for (const exercise of input.exercisesById ?? []) {
    for (let idx = 0; idx < exercise.weights.length; idx += 1) {
      const weight = exercise.weights[idx];
      await apiPost("/api/workout/set-log", {
        dateISO: input.dateISO,
        exerciseId: exercise.exerciseId,
        setNumber: idx + 1,
        weight: typeof weight === "number" ? weight : null,
      }).catch(() => undefined);
    }
  }
}

export async function getProgressBlocksHybrid(): Promise<unknown[] | null> {
  if (!hybridEnabled()) return null;
  try {
    const response = await apiGet<ProgressBlocksResponse>("/api/progress/blocks");
    return response.blocks ?? null;
  } catch {
    return null;
  }
}

export async function getProgressBlockHybrid(blockId: string): Promise<unknown | null> {
  if (!hybridEnabled()) return null;
  try {
    const response = await apiGet<ProgressBlockResponse>(`/api/progress/block/${blockId}`);
    return response.block ?? null;
  } catch {
    return null;
  }
}

export async function hydrateMeasuresHybrid(): Promise<MeasuresV1> {
  const local = loadMeasuresV1();
  if (!hybridEnabled()) return local;

  try {
    const response = await apiGet<MeasuresRowsResponse>("/api/measures/week");
    const mapped: MeasuresV1 = {
      version: 1,
      byWeek: {},
    };

    for (const row of response.rows ?? []) {
      mapped.byWeek[row.weekStartISO] = {
        weightKg: row.weightKg ?? undefined,
        neckCm: row.neckCm ?? undefined,
        armCm: row.armCm ?? undefined,
        waistCm: row.waistCm ?? undefined,
        abdomenCm: row.abdomenCm ?? undefined,
        hipCm: row.hipCm ?? undefined,
        thighCm: row.thighCm ?? undefined,
        note: row.note ?? undefined,
        updatedAtISO: row.updatedAt,
      };
    }

    const merged = Object.keys(mapped.byWeek).length > 0 ? mapped : local;
    saveMeasuresV1(merged);
    return merged;
  } catch {
    return local;
  }
}

export async function saveMeasureWeekHybrid(weekStartISO: string, row: MeasuresV1["byWeek"][string]): Promise<void> {
  const local = loadMeasuresV1();
  const next: MeasuresV1 = {
    ...local,
    byWeek: {
      ...local.byWeek,
      [weekStartISO]: row,
    },
  };
  saveMeasuresV1(next);

  if (!hybridEnabled()) return;

  await apiPost("/api/measures/week", {
    weekStartISO,
    weightKg: row.weightKg ?? null,
    neckCm: row.neckCm ?? null,
    armCm: row.armCm ?? null,
    waistCm: row.waistCm ?? null,
    abdomenCm: row.abdomenCm ?? null,
    hipCm: row.hipCm ?? null,
    thighCm: row.thighCm ?? null,
    note: row.note ?? null,
  }).catch(() => undefined);
}

export function getTodayIsoForHybrid(): string {
  return getLocalISODate();
}

export function ensureLocalSelections(): SelectionsV1 {
  return loadSelectionsV1() ?? defaultSelectionsV1();
}

export function ensureLocalMeasures(): MeasuresV1 {
  return loadMeasuresV1() ?? defaultMeasuresV1();
}

