import { prisma } from "@/lib/db";
import { resolveTrainingDay } from "@/lib/planResolver";
import { buildProgressBlocks } from "@/lib/progress";
import type { DayOfWeek, PlanV1, SelectionsV1, SettingsV1 } from "@/lib/types";
import { getActivePlanWithRelations } from "@/lib/services/planService";

function toPlanV1FromDb(activePlan: NonNullable<Awaited<ReturnType<typeof getActivePlanWithRelations>>>): PlanV1 {
  return {
    version: 1,
    sourceFileName: activePlan.sourceFileName,
    importedAtISO: activePlan.importedAt.toISOString(),
    nutrition: {
      cycleWeeks: Math.max(1, Math.max(...activePlan.nutritionDays.map((day) => day.weekIndex), 1)),
      days: activePlan.nutritionDays.map((day) => {
        const grouped = {
          DESAYUNO: [],
          ALMUERZO: [],
          COMIDA: [],
          MERIENDA: [],
          CENA: [],
          POSTRE: [],
        } as PlanV1["nutrition"]["days"][number]["meals"];

        for (const option of day.mealOptions) {
          grouped[option.mealType].push({
            optionId: option.id,
            title: option.title,
            lines: option.lines.map((line) => line.content),
          });
        }

        return {
          weekIndex: day.weekIndex,
          dayOfWeek: day.dayOfWeek,
          meals: grouped,
        };
      }),
    },
    training: {
      days: activePlan.trainingDays.map((day) => ({
        dayIndex: day.dayIndex,
        label: day.label,
        exercises: day.exercises.map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          series: exercise.sets,
          reps: exercise.reps,
          restSeconds: exercise.restSeconds,
          notes: exercise.notes,
        })),
      })),
    },
  };
}

function buildSelectionsFromLogs(params: {
  plan: PlanV1;
  sessions: Array<{
    dateISO: string;
    note: string | null;
    setLogs: Array<{ setNumber: number; weightKg: number | null; exerciseId: string }>;
  }>;
}): SelectionsV1 {
  const byDate: SelectionsV1["byDate"] = {};

  const exerciseIndexById = new Map<string, number>();
  params.plan.training.days.forEach((day) => {
    day.exercises.forEach((exercise, index) => {
      exerciseIndexById.set(exercise.id, index);
    });
  });

  for (const session of params.sessions) {
    const weightByExerciseIndex: Record<string, string[]> = {};

    for (const log of session.setLogs) {
      const exerciseIndex = exerciseIndexById.get(log.exerciseId);
      if (exerciseIndex === undefined) continue;
      const key = String(exerciseIndex);
      const arr = weightByExerciseIndex[key] ?? [];
      arr[log.setNumber - 1] = log.weightKg === null ? "" : String(log.weightKg);
      weightByExerciseIndex[key] = arr;
    }

    const lastWeightByExerciseIndex: Record<string, string> = {};
    const doneExerciseIndexes: number[] = [];

    for (const [index, values] of Object.entries(weightByExerciseIndex)) {
      const normalized = values.map((value) => value ?? "");
      lastWeightByExerciseIndex[index] = normalized.join("||");
      if (normalized.length > 0 && normalized.every((value) => value.trim().length > 0)) {
        doneExerciseIndexes.push(Number(index));
      }
    }

    byDate[session.dateISO] = {
      meals: {},
      workout: {
        doneExerciseIndexes: doneExerciseIndexes.sort((a, b) => a - b),
        lastWeightByExerciseIndex,
        note: session.note ?? "",
      },
    };
  }

  return { version: 1, byDate };
}

export async function buildProgressBlocksForUser(userId: string) {
  const activePlan = await getActivePlanWithRelations(userId);
  if (!activePlan) {
    return {
      blocks: [],
      plan: null as PlanV1 | null,
      settings: null as SettingsV1 | null,
      preferredBlockId: null as string | null,
      noPlan: true,
    };
  }

  const settingsRow = await prisma.userSettings.findUnique({ where: { userId } });
  const settings: SettingsV1 = {
    version: 1,
    nutritionStartDateISO: settingsRow?.nutritionStartDateISO ?? new Date().toISOString().slice(0, 10),
    trainingDays: (settingsRow?.trainingDays as DayOfWeek[] | undefined) ?? ["Mon", "Tue", "Wed", "Thu"],
  };

  const sessions = await prisma.workoutSession.findMany({
    where: { userId, planId: activePlan.id },
    orderBy: { dateISO: "asc" },
    select: {
      dateISO: true,
      note: true,
      setLogs: {
        select: { setNumber: true, weightKg: true, exerciseId: true },
      },
    },
  });

  const plan = toPlanV1FromDb(activePlan);
  const selections = buildSelectionsFromLogs({ plan, sessions });
  const blocks = buildProgressBlocks(plan, selections, settings);
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayTrainingDay = resolveTrainingDay(plan, todayISO, settings);
  const preferredByDayIndex = todayTrainingDay
    ? blocks.find((block) => {
        const match = block.blockId.match(/^block-(\d+)-/);
        return match ? Number(match[1]) === todayTrainingDay.dayIndex : false;
      })?.blockId ?? null
    : null;
  const preferredBlockId = preferredByDayIndex ?? blocks[0]?.blockId ?? null;

  return { blocks, plan, settings, preferredBlockId, noPlan: false };
}
