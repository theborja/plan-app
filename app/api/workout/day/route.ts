import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveTrainingDayFromDb } from "@/lib/services/dayResolvers";
import { ensureUserSettings, getActivePlanWithRelations } from "@/lib/services/planService";
import { isIsoDate, jsonError, requireAuth } from "@/lib/serverApi";

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
    latestSameTrainingNote:
      latestSameTrainingNote?.note && latestSameTrainingNote.note.trim()
        ? {
            dateISO: latestSameTrainingNote.dateISO,
            note: latestSameTrainingNote.note,
          }
        : null,
  });
}
