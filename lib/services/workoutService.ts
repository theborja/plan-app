import { getAutoTrainingWeekdays, getDayOfWeek } from "@/lib/date";
import { getActivePlanForUser } from "@/lib/services/planService";
import { prisma } from "@/lib/db";

function parseWeight(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitSeriesWeights(value: string): Array<number | null> {
  if (!value || !value.trim()) return [];
  const parts = value.includes("||")
    ? value.split("||")
    : [value];
  return parts.map(parseWeight);
}

export async function getWorkoutForDate(userId: string, dateISO: string) {
  const activePlan = await getActivePlanForUser(userId);
  if (!activePlan) return null;

  const weekdays = getAutoTrainingWeekdays(activePlan.planV1.training.days.length);
  const dayOfWeek = getDayOfWeek(dateISO);
  if (!weekdays.includes(dayOfWeek)) {
    return {
      planId: activePlan.id,
      dateISO,
      trainingDay: null,
      session: null,
    };
  }

  const daySlot = weekdays.indexOf(dayOfWeek);
  const trainingDay = activePlan.trainingDays
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)[daySlot] ?? null;

  if (!trainingDay) {
    return {
      planId: activePlan.id,
      dateISO,
      trainingDay: null,
      session: null,
    };
  }

  const session = await prisma.workoutSession.findUnique({
    where: {
      userId_planId_dateISO: {
        userId,
        planId: activePlan.id,
        dateISO,
      },
    },
    include: {
      setLogs: true,
    },
  });

  return {
    planId: activePlan.id,
    dateISO,
    trainingDay: {
      id: trainingDay.id,
      dayIndex: trainingDay.dayIndex,
      label: trainingDay.label,
      exercises: trainingDay.exercises
        .slice()
        .sort((a, b) => a.exerciseIndex - b.exerciseIndex)
        .map((exercise) => ({
          id: exercise.id,
          exerciseIndex: exercise.exerciseIndex,
          name: exercise.name,
          series: exercise.sets,
          reps: exercise.reps,
          restSeconds: exercise.restSeconds,
          notes: exercise.notes,
        })),
    },
    session: session
      ? {
          id: session.id,
          note: session.note,
          completed: session.completed,
          updatedAtISO: session.updatedAt.toISOString(),
          setLogs: session.setLogs.map((setLog) => ({
            exerciseId: setLog.exerciseId,
            setNumber: setLog.setNumber,
            weight: setLog.weight,
            repsDone: setLog.repsDone,
            done: setLog.done,
          })),
        }
      : null,
  };
}

export async function saveWorkoutSession(input: {
  userId: string;
  dateISO: string;
  trainingDayId?: string;
  note?: string;
  completed?: boolean;
}) {
  const activePlan = await getActivePlanForUser(input.userId);
  if (!activePlan) return null;

  let session = await prisma.workoutSession.findUnique({
    where: {
      userId_planId_dateISO: {
        userId: input.userId,
        planId: activePlan.id,
        dateISO: input.dateISO,
      },
    },
  });

  if (!session && !input.trainingDayId) {
    return null;
  }

  if (session) {
    session = await prisma.workoutSession.update({
      where: { id: session.id },
      data: {
        trainingDayId: input.trainingDayId ?? session.trainingDayId,
        note: input.note ?? null,
        completed: input.completed ?? false,
      },
    });
  } else {
    session = await prisma.workoutSession.create({
      data: {
        userId: input.userId,
        planId: activePlan.id,
        trainingDayId: input.trainingDayId as string,
        dateISO: input.dateISO,
        note: input.note ?? null,
        completed: input.completed ?? false,
      },
    });
  }

  return {
    id: session.id,
    updatedAtISO: session.updatedAt.toISOString(),
  };
}

export async function saveWorkoutSetLog(input: {
  userId: string;
  dateISO: string;
  exerciseId: string;
  setNumber: number;
  weight?: number | null;
  repsDone?: number | null;
  done?: boolean | null;
}) {
  const activePlan = await getActivePlanForUser(input.userId);
  if (!activePlan) return null;

  const exercise = await prisma.exercise.findUnique({ where: { id: input.exerciseId } });
  if (!exercise) {
    throw new Error("Exercise not found.");
  }

  const session = await prisma.workoutSession.upsert({
    where: {
      userId_planId_dateISO: {
        userId: input.userId,
        planId: activePlan.id,
        dateISO: input.dateISO,
      },
    },
    update: {
      trainingDayId: exercise.trainingDayId,
    },
    create: {
      userId: input.userId,
      planId: activePlan.id,
      trainingDayId: exercise.trainingDayId,
      dateISO: input.dateISO,
    },
  });

  const setLog = await prisma.exerciseSetLog.upsert({
    where: {
      sessionId_exerciseId_setNumber: {
        sessionId: session.id,
        exerciseId: input.exerciseId,
        setNumber: input.setNumber,
      },
    },
    update: {
      weight: input.weight ?? null,
      repsDone: input.repsDone ?? null,
      done: input.done ?? null,
    },
    create: {
      sessionId: session.id,
      exerciseId: input.exerciseId,
      setNumber: input.setNumber,
      weight: input.weight ?? null,
      repsDone: input.repsDone ?? null,
      done: input.done ?? null,
    },
  });

  return {
    id: setLog.id,
    updatedAtISO: setLog.updatedAt.toISOString(),
  };
}

export function encodeSeriesWeightsFromSetLogs(setLogs: Array<{ setNumber: number; weight: number | null }>): string {
  if (setLogs.length === 0) return "";
  return setLogs
    .slice()
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((setLog) => (setLog.weight === null ? "" : String(setLog.weight)))
    .join("||");
}

export function decodeSeriesWeights(input: string): Array<number | null> {
  return splitSeriesWeights(input);
}

