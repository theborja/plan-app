import type { NutritionDay, PlanV1, SettingsV1, TrainingDay } from "@/lib/types";
import { getDayOfWeek, getNutritionWeekIndex, isTrainingDay } from "@/lib/date";

export function resolveNutritionDay(
  plan: PlanV1,
  isoDate: string,
  settings: SettingsV1,
): NutritionDay | null {
  const dayOfWeek = getDayOfWeek(isoDate);
  const week = getNutritionWeekIndex(isoDate, settings.nutritionStartDateISO, 2);

  return (
    plan.nutrition.days.find(
      (day) => day.weekIndex === week && day.dayOfWeek === dayOfWeek,
    ) ?? null
  );
}

export function resolveTrainingDay(
  plan: PlanV1,
  isoDate: string,
  settings: SettingsV1,
): TrainingDay | null {
  const dayOfWeek = getDayOfWeek(isoDate);
  if (!isTrainingDay(dayOfWeek)) {
    return null;
  }

  const targetTrainingDay = settings.trainingDayMap[dayOfWeek];
  return (
    plan.training.days.find(
      (day, index) => day.dayIndex === targetTrainingDay || index === targetTrainingDay - 1,
    ) ?? null
  );
}

/*
Console checks (manual):
const nutrition = resolveNutritionDay(plan, "2026-02-14", settings);
const training = resolveTrainingDay(plan, "2026-02-14", settings);
*/
