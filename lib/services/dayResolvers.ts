import { DayOfWeek } from "@prisma/client";
import { getAutoTrainingWeekdays, getDayOfWeek, getNutritionWeekIndex } from "@/lib/date";

type DbTrainingDay = { id: string; dayIndex: number; label: string };
type DbNutritionDay = { id: string; weekIndex: number; dayOfWeek: DayOfWeek };

export function resolveNutritionDayFromDb(
  nutritionDays: DbNutritionDay[],
  isoDate: string,
  nutritionStartDateISO: string,
  cycleWeeks: number,
) {
  const dayOfWeek = getDayOfWeek(isoDate) as DayOfWeek;
  const week = getNutritionWeekIndex(isoDate, nutritionStartDateISO, cycleWeeks);
  return nutritionDays.find((day) => day.weekIndex === week && day.dayOfWeek === dayOfWeek) ?? null;
}

export function resolveTrainingDayFromDb(
  trainingDays: DbTrainingDay[],
  isoDate: string,
  trainingWeekdays: DayOfWeek[],
) {
  const dayOfWeek = getDayOfWeek(isoDate) as DayOfWeek;
  const weekdays =
    trainingWeekdays.length > 0
      ? trainingWeekdays
      : (getAutoTrainingWeekdays(trainingDays.length) as DayOfWeek[]);

  if (!weekdays.includes(dayOfWeek)) {
    return null;
  }

  const slot = weekdays.indexOf(dayOfWeek);
  if (slot < 0) return null;

  const target = slot + 1;
  return trainingDays.find((day, idx) => day.dayIndex === target || idx === slot) ?? null;
}
