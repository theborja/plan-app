import { DayOfWeek, MealType, PlanSourceType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAutoTrainingWeekdays } from "@/lib/date";
import type { PlanV1 } from "@/lib/types";

const DAY_ORDER: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const IMPORT_PLAN_TRANSACTION_MAX_WAIT_MS = 15_000;
const IMPORT_PLAN_TRANSACTION_TIMEOUT_MS = 60_000;

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseDayFromLabel(label: string): DayOfWeek | null {
  const token = normalizeToken(label);
  if (!token) return null;
  if (token.includes("LUNES") || token.includes("MONDAY")) return "Mon";
  if (token.includes("MARTES") || token.includes("TUESDAY")) return "Tue";
  if (token.includes("MIERCOLES") || token.includes("WEDNESDAY")) return "Wed";
  if (token.includes("JUEVES") || token.includes("THURSDAY")) return "Thu";
  if (token.includes("VIERNES") || token.includes("FRIDAY")) return "Fri";
  if (token.includes("SABADO") || token.includes("SATURDAY")) return "Sat";
  if (token.includes("DOMINGO") || token.includes("SUNDAY")) return "Sun";
  return null;
}

function inferTrainingDaysFromPlan(plan: PlanV1): DayOfWeek[] {
  const fromLabels = plan.training.days
    .map((day) => parseDayFromLabel(day.label))
    .filter((value): value is DayOfWeek => value !== null);

  const uniqueByLabel = [...new Set(fromLabels)].sort(
    (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
  );

  if (uniqueByLabel.length > 0) {
    return uniqueByLabel;
  }

  return getAutoTrainingWeekdays(plan.training.days.length) as DayOfWeek[];
}

function getTodayISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function ensureUserSettings(userId: string, plan?: PlanV1 | null) {
  const existing = await prisma.userSettings.findUnique({ where: { userId } });
  if (existing) return existing;

  const trainingDays = plan ? inferTrainingDaysFromPlan(plan) : (["Mon", "Tue", "Wed", "Thu"] as DayOfWeek[]);

  return prisma.userSettings.create({
    data: {
      userId,
      nutritionStartDateISO: getTodayISO(),
      trainingDays,
    },
  });
}

export async function importPlanForUser(params: {
  targetUserId: string;
  importedByUserId: string;
  parsedPlan: PlanV1;
}) {
  const { targetUserId, importedByUserId, parsedPlan } = params;

  const result = await prisma.$transaction(
    async (tx) => {
      await tx.userPlan.updateMany({
        where: { userId: targetUserId, isActive: true },
        data: { isActive: false },
      });

      const created = await tx.userPlan.create({
        data: {
          userId: targetUserId,
          importedByUserId,
          name: `Plan ${parsedPlan.sourceFileName}`,
          sourceFileName: parsedPlan.sourceFileName,
          sourceType: PlanSourceType.IMPORTED_EXCEL,
          isActive: true,
          importedAt: new Date(parsedPlan.importedAtISO),
          trainingDays: {
            create: parsedPlan.training.days.map((day, dayIdx) => ({
              dayIndex: day.dayIndex || dayIdx + 1,
              label: day.label,
              sortOrder: dayIdx,
              exercises: {
                create: day.exercises.map((exercise, exIdx) => ({
                  exerciseIndex: exIdx,
                  name: exercise.name,
                  sets: exercise.series ?? null,
                  reps: exercise.reps ?? null,
                  restSeconds: exercise.restSeconds ?? null,
                  notes: exercise.notes ?? null,
                })),
              },
            })),
          },
          nutritionDays: {
            create: parsedPlan.nutrition.days.map((day, dayIdx) => ({
              weekIndex: day.weekIndex,
              dayOfWeek: day.dayOfWeek as DayOfWeek,
              sortOrder: dayIdx,
              mealOptions: {
                create: (Object.entries(day.meals) as [MealType, Array<{ title: string; lines: string[] }>][])
                  .flatMap(([mealType, options]) =>
                    options.map((option, optIdx) => ({
                      mealType,
                      optionIndex: optIdx + 1,
                      title: option.title || `Opcion ${optIdx + 1}`,
                      lines: {
                        create: option.lines.map((line, lineIdx) => ({
                          lineIndex: lineIdx,
                          content: line,
                        })),
                      },
                    })),
                  ),
              },
            })),
          },
        },
      });

      return created;
    },
    {
      maxWait: IMPORT_PLAN_TRANSACTION_MAX_WAIT_MS,
      timeout: IMPORT_PLAN_TRANSACTION_TIMEOUT_MS,
    },
  );

  await ensureUserSettings(targetUserId, parsedPlan);
  return result;
}

const activePlanInclude = {
  trainingDays: {
    orderBy: [{ sortOrder: "asc" }],
    include: {
      exercises: { orderBy: [{ exerciseIndex: "asc" }] },
    },
  },
  nutritionDays: {
    orderBy: [{ sortOrder: "asc" }],
    include: {
      mealOptions: {
        orderBy: [{ mealType: "asc" }, { optionIndex: "asc" }],
        include: { lines: { orderBy: [{ lineIndex: "asc" }] } },
      },
    },
  },
} satisfies Prisma.UserPlanInclude;

export async function getActivePlanWithRelations(userId: string) {
  return prisma.userPlan.findFirst({
    where: { userId, isActive: true },
    include: activePlanInclude,
    orderBy: { importedAt: "desc" },
  });
}

export async function getPlanHistory(userId: string) {
  return prisma.userPlan.findMany({
    where: { userId },
    orderBy: { importedAt: "desc" },
    select: {
      id: true,
      name: true,
      sourceFileName: true,
      sourceType: true,
      importedAt: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export function toApiPlan(activePlan: NonNullable<Awaited<ReturnType<typeof getActivePlanWithRelations>>>) {
  const nutritionDays = activePlan.nutritionDays.map((day) => {
    const meals: Record<MealType, Array<{ id: string; title: string; lines: string[] }>> = {
      DESAYUNO: [],
      ALMUERZO: [],
      COMIDA: [],
      MERIENDA: [],
      CENA: [],
      POSTRE: [],
    };

    for (const option of day.mealOptions) {
      meals[option.mealType].push({
        id: option.id,
        title: option.title,
        lines: option.lines.map((line) => line.content),
      });
    }

    return {
      id: day.id,
      weekIndex: day.weekIndex,
      dayOfWeek: day.dayOfWeek,
      meals,
    };
  });

  return {
    id: activePlan.id,
    name: activePlan.name,
    sourceFileName: activePlan.sourceFileName,
    importedAt: activePlan.importedAt,
    trainingDays: activePlan.trainingDays.map((day) => ({
      id: day.id,
      dayIndex: day.dayIndex,
      label: day.label,
      exercises: day.exercises.map((exercise) => ({
        id: exercise.id,
        exerciseIndex: exercise.exerciseIndex,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        restSeconds: exercise.restSeconds,
        notes: exercise.notes,
      })),
    })),
    nutritionDays,
  };
}
