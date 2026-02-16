import type { NutritionDay, PlanV1, SettingsV1, TrainingDay } from "@/lib/types";
import { getAutoTrainingWeekdays, getDayOfWeek, getNutritionWeekIndex, isTrainingDay } from "@/lib/date";

export function resolveNutritionDay(
  plan: PlanV1,
  isoDate: string,
  settings: SettingsV1,
): NutritionDay | null {
  const dayOfWeek = getDayOfWeek(isoDate);
  const week = getNutritionWeekIndex(
    isoDate,
    settings.nutritionStartDateISO,
    plan.nutrition.cycleWeeks,
  );

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
  const trainingWeekdays =
    settings.trainingDays.length > 0
      ? settings.trainingDays
      : getAutoTrainingWeekdays(plan.training.days.length);

  if (!isTrainingDay(dayOfWeek, trainingWeekdays)) {
    return null;
  }

  const daySlot = trainingWeekdays.indexOf(dayOfWeek);
  if (daySlot < 0) return null;

  const targetTrainingDay = daySlot + 1;
  return (
    plan.training.days.find(
      (day, index) => day.dayIndex === targetTrainingDay || index === daySlot,
    ) ?? null
  );
}

/*
Console checks (manual):
const nutrition = resolveNutritionDay(plan, "2026-02-14", settings);
const training = resolveTrainingDay(plan, "2026-02-14", settings);
*/
