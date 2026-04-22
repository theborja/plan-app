import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveTrainingDayFromDb } from "@/lib/services/dayResolvers";
import { ensureUserSettings, getActivePlanWithRelations } from "@/lib/services/planService";
import { isIsoDate, jsonError, requireAuth } from "@/lib/serverApi";

type LatestWeightLog = { setNumber: number; weightKg: number | null };
type LatestWeightsByExerciseId = Record<string, LatestWeightLog[]>;
type WorkoutExercise = {
  id: string;
  name: string;
};

async function getPreviousPlanWeightsFallback(params: {
  userId: string;
  activePlanId: string;
  activePlanImportedAt: Date;
  dateISO: string;
  exercises: WorkoutExercise[];
  currentWeightsByExerciseId: LatestWeightsByExerciseId;
}) {
  const missingExercises = params.exercises.filter(
    (exercise) => (params.currentWeightsByExerciseId[exercise.id] ?? []).length === 0,
  );
  if (missingExercises.length === 0) {
    return { weightsByExerciseId: params.currentWeightsByExerciseId, fallbackDateISO: null };
  }

  const exerciseNames = [...new Set(missingExercises.map((exercise) => exercise.name))];
  const previousPlan = await prisma.userPlan.findFirst({
    where: {
      userId: params.userId,
      id: { not: params.activePlanId },
      isActive: false,
      importedAt: { lt: params.activePlanImportedAt },
    },
    orderBy: { importedAt: "desc" },
    select: { id: true },
  });

  if (!previousPlan) {
    return { weightsByExerciseId: params.currentWeightsByExerciseId, fallbackDateISO: null };
  }

  const previousLogs = await prisma.exerciseSetLog.findMany({
    where: {
      weightKg: { not: null },
      session: {
        userId: params.userId,
        planId: previousPlan.id,
        dateISO: { not: params.dateISO },
      },
      exercise: {
        name: { in: exerciseNames },
        trainingDay: { planId: previousPlan.id },
      },
    },
    orderBy: [
      { session: { dateISO: "desc" } },
      { exerciseId: "asc" },
      { setNumber: "asc" },
    ],
    select: {
      setNumber: true,
      weightKg: true,
      session: { select: { dateISO: true } },
      exercise: { select: { name: true } },
    },
  });

  const fallbackByExerciseName = new Map<string, { dateISO: string; logs: LatestWeightLog[] }>();
  for (const log of previousLogs) {
    const exerciseName = log.exercise.name;
    const existing = fallbackByExerciseName.get(exerciseName);
    if (!existing) {
      fallbackByExerciseName.set(exerciseName, {
        dateISO: log.session.dateISO,
        logs: [{ setNumber: log.setNumber, weightKg: log.weightKg }],
      });
      continue;
    }

    if (existing.dateISO === log.session.dateISO) {
      existing.logs.push({ setNumber: log.setNumber, weightKg: log.weightKg });
    }
  }

  let fallbackDateISO: string | null = null;
  const weightsByExerciseId: LatestWeightsByExerciseId = { ...params.currentWeightsByExerciseId };

  for (const exercise of missingExercises) {
    const fallback = fallbackByExerciseName.get(exercise.name);
    if (!fallback) continue;

    weightsByExerciseId[exercise.id] = fallback.logs;
    if (!fallbackDateISO || fallback.dateISO > fallbackDateISO) {
      fallbackDateISO = fallback.dateISO;
    }
  }

  return { weightsByExerciseId, fallbackDateISO };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const dateISO = request.nextUrl.searchParams.get("date") ?? "";
  if (!isIsoDate(dateISO)) {
    return jsonError("Parametro date invalido. Usa YYYY-MM-DD.", 400);
  }

  const userId = auth.user!.id;
  const activePlan = await getActivePlanWithRelations(userId);
  const settings = await ensureUserSettings(userId, null);

  if (!activePlan) {
    return NextResponse.json({ ok: true, noPlan: true, trainingDay: null, session: null, settings });
  }

  const trainingDay = resolveTrainingDayFromDb(
    activePlan.trainingDays.map((day) => ({ id: day.id, dayIndex: day.dayIndex, label: day.label })),
    dateISO,
    settings.trainingDays,
  );

  if (!trainingDay) {
    return NextResponse.json({ ok: true, noPlan: false, trainingDay: null, session: null, settings });
  }

  const fullDay = activePlan.trainingDays.find((day) => day.id === trainingDay.id)!;

  const session = await prisma.workoutSession.findUnique({
    where: { userId_dateISO: { userId, dateISO } },
    include: {
      setLogs: {
        orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
      },
    },
  });

  const latestSameTrainingNote = await prisma.workoutSession.findFirst({
    where: {
      userId,
      trainingDayId: fullDay.id,
      dateISO: { not: dateISO },
      note: { not: null },
    },
    orderBy: [{ dateISO: "desc" }],
    select: {
      dateISO: true,
      note: true,
    },
  });

  const latestSameTrainingSessionWithWeights = await prisma.workoutSession.findFirst({
    where: {
      userId,
      trainingDayId: fullDay.id,
      dateISO: { not: dateISO },
      setLogs: {
        some: {
          weightKg: { not: null },
        },
      },
    },
    orderBy: [{ dateISO: "desc" }],
    select: {
      dateISO: true,
      setLogs: {
        where: {
          weightKg: { not: null },
        },
        orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
        select: {
          exerciseId: true,
          setNumber: true,
          weightKg: true,
        },
      },
    },
  });

  const setLogsByExerciseId = fullDay.exercises.reduce<Record<string, Array<{ setNumber: number; weightKg: number | null; done: boolean | null; repsDone: number | null }>>>(
    (acc, exercise) => {
      acc[exercise.id] = (session?.setLogs ?? [])
        .filter((log) => log.exerciseId === exercise.id)
        .map((log) => ({
          setNumber: log.setNumber,
          weightKg: log.weightKg,
          done: log.done,
          repsDone: log.repsDone,
        }));
      return acc;
    },
    {},
  );

  const latestSameTrainingSetLogsByExerciseId = fullDay.exercises.reduce<Record<string, Array<{ setNumber: number; weightKg: number | null }>>>(
    (acc, exercise) => {
      acc[exercise.id] = (latestSameTrainingSessionWithWeights?.setLogs ?? [])
        .filter((log) => log.exerciseId === exercise.id)
        .map((log) => ({
          setNumber: log.setNumber,
          weightKg: log.weightKg,
        }));
      return acc;
    },
    {},
  );
  const latestWeightsFallback = await getPreviousPlanWeightsFallback({
    userId,
    activePlanId: activePlan.id,
    activePlanImportedAt: activePlan.importedAt,
    dateISO,
    exercises: fullDay.exercises.map((exercise) => ({ id: exercise.id, name: exercise.name })),
    currentWeightsByExerciseId: latestSameTrainingSetLogsByExerciseId,
  });
  const latestWeightsByExerciseId = latestWeightsFallback.weightsByExerciseId;
  const hasLatestWeights = Object.values(latestWeightsByExerciseId).some((logs) => logs.length > 0);

  return NextResponse.json({
    ok: true,
    noPlan: false,
    trainingDay: {
      id: fullDay.id,
      dayIndex: fullDay.dayIndex,
      label: fullDay.label,
      exercises: fullDay.exercises.map((exercise) => ({
        id: exercise.id,
        exerciseIndex: exercise.exerciseIndex,
        name: exercise.name,
        sets: exercise.sets,
        reps: exercise.reps,
        restSeconds: exercise.restSeconds,
        notes: exercise.notes,
      })),
    },
    session: session
      ? {
          id: session.id,
          note: session.note ?? "",
          setLogsByExerciseId,
        }
      : null,
    settings,
    planId: activePlan.id,
    latestSameTrainingWeights:
      hasLatestWeights
        ? {
            dateISO: latestSameTrainingSessionWithWeights?.dateISO ?? latestWeightsFallback.fallbackDateISO,
            setLogsByExerciseId: latestWeightsByExerciseId,
          }
        : null,
    latestSameTrainingNote:
      latestSameTrainingNote?.note && latestSameTrainingNote.note.trim()
        ? {
            dateISO: latestSameTrainingNote.dateISO,
            note: latestSameTrainingNote.note,
          }
        : null,
  });
}
