import type {
  DailySelections,
  DayOfWeek,
  MealSelection,
  PlanV1,
  SelectionsV1,
  SettingsV1,
  MealType,
} from "@/lib/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isIsoDate(value: unknown): value is string {
  if (!isString(value)) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoDateTime(value: unknown): value is string {
  if (!isString(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

const DAY_ORDER: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MEAL_TYPES: MealType[] = [
  "DESAYUNO",
  "ALMUERZO",
  "COMIDA",
  "MERIENDA",
  "CENA",
  "POSTRE",
];

function isMealSelection(value: unknown): value is MealSelection {
  if (!isRecord(value)) return false;
  if (value.selectedOptionId !== undefined && !isString(value.selectedOptionId)) return false;
  if (value.done !== undefined && typeof value.done !== "boolean") return false;
  if (value.note !== undefined && !isString(value.note)) return false;
  if (value.updatedAtISO !== undefined && !isIsoDateTime(value.updatedAtISO)) return false;
  return true;
}

function isDailySelections(value: unknown): value is DailySelections {
  if (!isRecord(value)) return false;
  if (!isRecord(value.meals)) return false;

  for (const mealType of Object.keys(value.meals)) {
    if (!MEAL_TYPES.includes(mealType as MealType)) return false;
    if (!isMealSelection(value.meals[mealType])) return false;
  }

  if (value.dailyMenu !== undefined) {
    if (!isRecord(value.dailyMenu)) return false;
    if (value.dailyMenu.selectedDayOptionId !== undefined && !isString(value.dailyMenu.selectedDayOptionId)) {
      return false;
    }
    if (value.dailyMenu.done !== undefined && typeof value.dailyMenu.done !== "boolean") return false;
    if (value.dailyMenu.note !== undefined && !isString(value.dailyMenu.note)) return false;
    if (value.dailyMenu.updatedAtISO !== undefined && !isIsoDateTime(value.dailyMenu.updatedAtISO)) {
      return false;
    }
  }

  if (value.workout !== undefined) {
    if (!isRecord(value.workout)) return false;
    if (!Array.isArray(value.workout.doneExerciseIndexes)) return false;
    if (!value.workout.doneExerciseIndexes.every((n) => Number.isInteger(n) && n >= 0)) {
      return false;
    }
    if (value.workout.lastWeightByExerciseIndex !== undefined) {
      if (!isRecord(value.workout.lastWeightByExerciseIndex)) return false;
      for (const [key, weightValue] of Object.entries(value.workout.lastWeightByExerciseIndex)) {
        if (!/^\d+$/.test(key)) return false;
        if (!isString(weightValue)) return false;
      }
    }
    if (value.workout.note !== undefined && !isString(value.workout.note)) return false;
    if (value.workout.updatedAtISO !== undefined && !isIsoDateTime(value.workout.updatedAtISO)) {
      return false;
    }
  }

  return true;
}

export function isPlanV1(value: unknown): value is PlanV1 {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (!isString(value.sourceFileName)) return false;
  if (!isIsoDateTime(value.importedAtISO)) return false;
  if (!isRecord(value.nutrition)) return false;
  if (typeof value.nutrition.cycleWeeks !== "number" || value.nutrition.cycleWeeks <= 0) {
    return false;
  }
  if (!Array.isArray(value.nutrition.days)) return false;
  if (!isRecord(value.training) || !Array.isArray(value.training.days)) return false;
  return true;
}

export function isSelectionsV1(value: unknown): value is SelectionsV1 {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (!isRecord(value.byDate)) return false;

  for (const [dateIso, daySelection] of Object.entries(value.byDate)) {
    if (!isIsoDate(dateIso)) return false;
    if (!isDailySelections(daySelection)) return false;
  }

  return true;
}

export function isSettingsV1(value: unknown): value is SettingsV1 {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (!isIsoDate(value.nutritionStartDateISO)) return false;
  if (!Array.isArray(value.trainingDays)) return false;
  if (!value.trainingDays.every((day) => isString(day) && DAY_ORDER.includes(day as DayOfWeek))) {
    return false;
  }

  const unique = new Set(value.trainingDays);
  return unique.size === value.trainingDays.length;
}
