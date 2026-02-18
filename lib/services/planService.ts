import type {
  MealType as PrismaMealType,
  Plan,
  TrainingDay,
  Exercise,
  NutritionDayOption,
  NutritionMeal,
  Weekday,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import type { DayOfWeek, MealType, PlanV1 } from "@/lib/types";

const DAY_ORDER: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_ORDER: MealType[] = ["DESAYUNO", "ALMUERZO", "COMIDA", "MERIENDA", "CENA", "POSTRE"];

type PlanWithRelations = Plan & {
  trainingDays: Array<TrainingDay & { exercises: Exercise[] }>;
  nutritionDayOptions: Array<NutritionDayOption & { meals: NutritionMeal[] }>;
};

function normalizeName(sourceFileName: string): string {
  const clean = sourceFileName.trim();
  return clean.length > 0 ? clean : "Plan importado";
}

function weekdayToPrisma(day: DayOfWeek): Weekday {
  return day as Weekday;
}

function weekdayFromPrisma(day: Weekday): DayOfWeek {
  return day as DayOfWeek;
}

function mealTypeToPrisma(mealType: MealType): PrismaMealType {
  if (mealType === "POSTRE") return "POSTRE_COMIDA";
  return mealType as PrismaMealType;
}

function mealTypeFromPrisma(mealType: PrismaMealType): MealType {
  if (mealType === "POSTRE_COMIDA" || mealType === "POSTRE_CENA") return "POSTRE";
  return mealType as MealType;
}

function parseIntOrNull(value: number | null | undefined): number | null {
  if (value === undefined || value === null) return null;
  return Number.isFinite(value) ? Math.floor(value) : null;
}

export function mapDbPlanToPlanV1(plan: PlanWithRelations): PlanV1 {
  const nutritionDays = plan.nutritionDayOptions
    .slice()
    .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.dayOptionIndex - b.dayOptionIndex))
    .map((option) => {
      const mealsMap: PlanV1["nutrition"]["days"][number]["meals"] = {
        DESAYUNO: [],
        ALMUERZO: [],
        COMIDA: [],
        MERIENDA: [],
        CENA: [],
        POSTRE: [],
      };

      for (const meal of option.meals.slice().sort((a, b) => a.sortOrder - b.sortOrder)) {
        const mealType = mealTypeFromPrisma(meal.mealType);
        mealsMap[mealType].push({
          optionId: `${option.dayOptionIndex}-${mealType}`,
          title: mealType,
          lines: meal.content
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
        });
      }

      return {
        weekIndex: option.weekIndex,
        dayOfWeek: weekdayFromPrisma(option.dayOfWeek),
        meals: mealsMap,
      };
    });

  const trainingDays = plan.trainingDays
    .slice()
    .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.dayIndex - b.dayIndex))
    .map((day) => ({
      dayIndex: day.dayIndex,
      label: day.label,
      exercises: day.exercises
        .slice()
        .sort((a, b) => a.exerciseIndex - b.exerciseIndex)
        .map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          series: parseIntOrNull(exercise.sets),
          reps: exercise.reps,
          restSeconds: parseIntOrNull(exercise.restSeconds),
          notes: exercise.notes,
        })),
    }));

  return {
    version: 1,
    sourceFileName: plan.sourceFileName,
    importedAtISO: plan.importedAt.toISOString(),
    nutrition: {
      cycleWeeks: Math.max(1, Math.max(...nutritionDays.map((d) => d.weekIndex), 1)),
      days: nutritionDays,
    },
    training: {
      days: trainingDays,
    },
  };
}

export async function getActivePlanForUser(userId: string): Promise<(PlanWithRelations & { planV1: PlanV1 }) | null> {
  const plan = await prisma.plan.findFirst({
    where: { userId, isActive: true },
    orderBy: { importedAt: "desc" },
    include: {
      trainingDays: { include: { exercises: true } },
      nutritionDayOptions: { include: { meals: true } },
    },
  });

  if (!plan) return null;
  return {
    ...plan,
    planV1: mapDbPlanToPlanV1(plan),
  };
}

export async function getPlanHistoryForUser(userId: string) {
  return prisma.plan.findMany({
    where: { userId },
    orderBy: { importedAt: "desc" },
    select: {
      id: true,
      name: true,
      sourceFileName: true,
      sourceType: true,
      isActive: true,
      importedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function importPlanForUser(input: {
  userId: string;
  sourceFileName: string;
  plan: PlanV1;
}) {
  const { userId, sourceFileName, plan } = input;

  const nutritionDays = plan.nutrition.days
    .slice()
    .sort((a, b) => {
      if (a.weekIndex === b.weekIndex) {
        return DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
      }
      return a.weekIndex - b.weekIndex;
    });

  return prisma.$transaction(async (tx) => {
    await tx.plan.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });

    const createdPlan = await tx.plan.create({
      data: {
        userId,
        name: normalizeName(sourceFileName),
        sourceFileName,
        sourceType: "IMPORTED_EXCEL",
        isActive: true,
        importedAt: new Date(plan.importedAtISO),
      },
    });

    for (let dayIdx = 0; dayIdx < plan.training.days.length; dayIdx += 1) {
      const day = plan.training.days[dayIdx];
      const createdDay = await tx.trainingDay.create({
        data: {
          planId: createdPlan.id,
          dayIndex: day.dayIndex || (dayIdx + 1),
          label: day.label,
          sortOrder: dayIdx + 1,
        },
      });

      if (day.exercises.length > 0) {
        await tx.exercise.createMany({
          data: day.exercises.map((exercise, exIdx) => ({
            trainingDayId: createdDay.id,
            exerciseIndex: exIdx,
            name: exercise.name,
            sets: exercise.series ?? null,
            reps: exercise.reps ?? null,
            restSeconds: exercise.restSeconds ?? null,
            notes: exercise.notes ?? null,
          })),
        });
      }
    }

    for (let optionIdx = 0; optionIdx < nutritionDays.length; optionIdx += 1) {
      const option = nutritionDays[optionIdx];
      const createdOption = await tx.nutritionDayOption.create({
        data: {
          planId: createdPlan.id,
          weekIndex: option.weekIndex,
          dayOfWeek: weekdayToPrisma(option.dayOfWeek),
          dayOptionIndex: optionIdx + 1,
          label: `Semana ${option.weekIndex} - ${option.dayOfWeek}`,
          sortOrder: optionIdx + 1,
        },
      });

      const mealsPayload: Array<{ mealType: PrismaMealType; content: string; sortOrder: number }> = [];
      let sortOrder = 1;
      for (const mealType of MEAL_ORDER) {
        const options = option.meals[mealType] ?? [];
        const lines = options.flatMap((item) => item.lines).map((line) => line.trim()).filter(Boolean);
        if (lines.length === 0) continue;

        mealsPayload.push({
          mealType: mealTypeToPrisma(mealType),
          content: lines.join("\n"),
          sortOrder,
        });
        sortOrder += 1;
      }

      if (mealsPayload.length > 0) {
        await tx.nutritionMeal.createMany({
          data: mealsPayload.map((meal) => ({
            nutritionDayOptionId: createdOption.id,
            mealType: meal.mealType,
            content: meal.content,
            sortOrder: meal.sortOrder,
          })),
        });
      }
    }

    return createdPlan;
  });
}

