import type { DayOfWeek } from "@/lib/types";

const DAY_ORDER: DayOfWeek[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_ORDER_MON_FIRST: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseISODate(isoDate: string): Date {
  const [yearStr, monthStr, dayStr] = isoDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }

  return new Date(year, month - 1, day);
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalISODate(date = new Date()): string {
  return toISODate(date);
}

export function getDayOfWeek(isoDate: string): DayOfWeek {
  const date = parseISODate(isoDate);
  return DAY_ORDER[date.getDay()];
}

export function getAutoTrainingWeekdays(trainingDaysCount: number): DayOfWeek[] {
  const count = Math.max(0, Math.min(7, Math.floor(trainingDaysCount)));
  return DAY_ORDER_MON_FIRST.slice(0, count);
}

export function isTrainingDay(day: DayOfWeek, trainingDays: DayOfWeek[]): boolean {
  return trainingDays.includes(day);
}

export function getNextTrainingDay(fromIsoDate: string, trainingDays: DayOfWeek[]): {
  isoDate: string;
  dayOfWeek: DayOfWeek;
} {
  if (trainingDays.length === 0) {
    throw new Error("No training days configured.");
  }

  const baseDate = parseISODate(fromIsoDate);

  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(baseDate);
    candidate.setDate(baseDate.getDate() + offset);
    const day = DAY_ORDER[candidate.getDay()];
    if (isTrainingDay(day, trainingDays)) {
      return {
        isoDate: toISODate(candidate),
        dayOfWeek: day,
      };
    }
  }

  throw new Error("Unable to resolve next training day.");
}

export function getNutritionWeekIndex(
  isoDate: string,
  startDateISO: string,
  cycleWeeks = 2,
): number {
  if (cycleWeeks <= 0) {
    throw new Error("cycleWeeks must be greater than 0.");
  }

  const current = parseISODate(isoDate);
  const start = parseISODate(startDateISO);
  const daysDiff = Math.floor((current.getTime() - start.getTime()) / MS_PER_DAY);
  const weeksElapsed = Math.floor(daysDiff / 7);
  const cycleOffset = ((weeksElapsed % cycleWeeks) + cycleWeeks) % cycleWeeks;
  return cycleOffset + 1;
}

export function getCycleDayIndex(
  isoDate: string,
  startDateISO: string,
  cycleLength: number,
): number {
  if (cycleLength <= 0) {
    throw new Error("cycleLength must be greater than 0.");
  }

  const current = parseISODate(isoDate);
  const start = parseISODate(startDateISO);
  const daysDiff = Math.floor((current.getTime() - start.getTime()) / MS_PER_DAY);
  return ((daysDiff % cycleLength) + cycleLength) % cycleLength;
}

export function formatDayLabel(isoDate: string): string {
  const date = parseISODate(isoDate);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

export function formatDateDDMMYYYY(isoDate: string): string {
  return formatDayLabel(isoDate);
}

export function formatDateLongSpanish(isoDate: string): string {
  const date = parseISODate(isoDate);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

export function formatDateShortSpanish(isoDate: string): string {
  const date = parseISODate(isoDate);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(date);
}

/*
Console checks (manual):
console.log(getDayOfWeek("2026-02-14")); // Sat
console.log(isTrainingDay("Sat", ["Mon", "Tue", "Wed", "Thu", "Fri"])); // false
console.log(getNextTrainingDay("2026-02-13", ["Mon", "Tue", "Wed", "Thu", "Fri"]));
console.log(getNutritionWeekIndex("2026-02-14", "2026-02-09", 3)); // 1..3
console.log(getCycleDayIndex("2026-02-14", "2026-02-09", 21)); // 0..20
*/
