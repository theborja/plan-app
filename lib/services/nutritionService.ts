import { getCycleDayIndex } from "@/lib/date";
import { getActivePlanForUser } from "@/lib/services/planService";
import { prisma } from "@/lib/db";
import type { MealType } from "@/lib/types";

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function mealTypeSortValue(mealType: MealType): number {
  const order: MealType[] = ["DESAYUNO", "ALMUERZO", "COMIDA", "MERIENDA", "CENA", "POSTRE"];
  return order.indexOf(mealType);
}

export async function getNutritionForDate(userId: string, dateISO: string) {
  const activePlan = await getActivePlanForUser(userId);
  if (!activePlan) {
    return null;
  }

  const sortedDays = activePlan.planV1.nutrition.days
    .slice()
    .sort((a, b) => {
      if (a.weekIndex === b.weekIndex) {
        return DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
      }
      return a.weekIndex - b.weekIndex;
    })
    .map((day, index) => ({
      dayOptionIndex: index + 1,
      weekIndex: day.weekIndex,
      dayOfWeek: day.dayOfWeek,
      optionId: `${day.weekIndex}-${day.dayOfWeek}`,
      optionLabel: `Opcion ${index + 1}`,
      meals: Object.entries(day.meals)
        .map(([mealType, options]) => ({
          mealType: mealType as MealType,
          lines: options.flatMap((option) => option.lines).map((line) => line.trim()).filter(Boolean),
        }))
        .filter((meal) => meal.lines.length > 0)
        .sort((a, b) => mealTypeSortValue(a.mealType) - mealTypeSortValue(b.mealType)),
    }));

  const dayCount = sortedDays.length;
  const importedStart = activePlan.planV1.importedAtISO.slice(0, 10);
  const suggestedIndex = dayCount > 0 ? getCycleDayIndex(dateISO, importedStart, dayCount) + 1 : null;

  const log = await prisma.mealSelectionLog.findUnique({
    where: {
      userId_planId_dateISO: {
        userId,
        planId: activePlan.id,
        dateISO,
      },
    },
  });

  return {
    planId: activePlan.id,
    sourceFileName: activePlan.sourceFileName,
    dateISO,
    options: sortedDays,
    selection: log
      ? {
          selectedDayOptionIndex: log.selectedDayOptionIndex,
          done: log.done,
          note: log.note,
          updatedAtISO: log.updatedAt.toISOString(),
        }
      : null,
    suggestedDayOptionIndex: suggestedIndex,
  };
}

export async function saveNutritionSelection(input: {
  userId: string;
  dateISO: string;
  selectedDayOptionIndex?: number | null;
  done?: boolean;
  note?: string;
}) {
  const activePlan = await getActivePlanForUser(input.userId);
  if (!activePlan) return null;

  const log = await prisma.mealSelectionLog.upsert({
    where: {
      userId_planId_dateISO: {
        userId: input.userId,
        planId: activePlan.id,
        dateISO: input.dateISO,
      },
    },
    update: {
      selectedDayOptionIndex: input.selectedDayOptionIndex ?? null,
      done: input.done ?? false,
      note: input.note ?? null,
    },
    create: {
      userId: input.userId,
      planId: activePlan.id,
      dateISO: input.dateISO,
      selectedDayOptionIndex: input.selectedDayOptionIndex ?? null,
      done: input.done ?? false,
      note: input.note ?? null,
    },
  });

  return {
    selectedDayOptionIndex: log.selectedDayOptionIndex,
    done: log.done,
    note: log.note,
    updatedAtISO: log.updatedAt.toISOString(),
  };
}

