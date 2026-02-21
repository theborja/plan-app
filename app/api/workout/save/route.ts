import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveTrainingDayFromDb } from "@/lib/services/dayResolvers";
import { ensureUserSettings, getActivePlanWithRelations } from "@/lib/services/planService";
import { isIsoDate, jsonError, requireAuth } from "@/lib/serverApi";

type InputSetLog = {
  exerciseId?: string;
  setNumber?: number;
  weightKg?: number | null;
};

type Body = {
  dateISO?: string;
  note?: string;
  setLogs?: InputSetLog[];
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Body;
  const dateISO = body.dateISO ?? "";
  if (!isIsoDate(dateISO)) return jsonError("dateISO invalido. Usa YYYY-MM-DD.", 400);

  const userId = auth.user!.id;
  const activePlan = await getActivePlanWithRelations(userId);
  if (!activePlan) return jsonError("No hay plan activo.", 400);

  const settings = await ensureUserSettings(userId, null);
  const trainingDay = resolveTrainingDayFromDb(
    activePlan.trainingDays.map((day) => ({ id: day.id, dayIndex: day.dayIndex, label: day.label })),
    dateISO,
    settings.trainingDays,
  );
  if (!trainingDay) return jsonError("No hay entrenamiento asignado para esa fecha.", 400);

  const fullDay = activePlan.trainingDays.find((day) => day.id === trainingDay.id)!;
  const validExerciseIds = new Set(fullDay.exercises.map((exercise) => exercise.id));

  const rawSetLogs = Array.isArray(body.setLogs) ? body.setLogs : [];
  const normalizedLogs = rawSetLogs
    .map((item) => ({
      exerciseId: (item.exerciseId ?? "").trim(),
      setNumber: Number(item.setNumber ?? 0),
      weightKg: typeof item.weightKg === "number" && Number.isFinite(item.weightKg) ? item.weightKg : null,
    }))
    .filter((item) => item.exerciseId && Number.isInteger(item.setNumber) && item.setNumber > 0);

  const invalid = normalizedLogs.find((item) => !validExerciseIds.has(item.exerciseId));
  if (invalid) {
    return jsonError("Se enviaron ejercicios que no pertenecen al entrenamiento del dia.", 400);
  }

  const dedup = new Map<string, { exerciseId: string; setNumber: number; weightKg: number | null }>();
  for (const log of normalizedLogs) {
    dedup.set(`${log.exerciseId}:${log.setNumber}`, log);
  }

  const uniqueLogs = [...dedup.values()].filter((log) => log.weightKg !== null);

  const result = await prisma.$transaction(async (tx) => {
    const session = await tx.workoutSession.upsert({
      where: { userId_dateISO: { userId, dateISO } },
      create: {
        userId,
        planId: activePlan.id,
        trainingDayId: trainingDay.id,
        dateISO,
        note: body.note ?? "",
      },
      update: {
        planId: activePlan.id,
        trainingDayId: trainingDay.id,
        note: body.note ?? "",
      },
    });

    await tx.exerciseSetLog.deleteMany({
      where: {
        sessionId: session.id,
        exerciseId: { in: [...validExerciseIds] },
      },
    });

    if (uniqueLogs.length > 0) {
      await tx.exerciseSetLog.createMany({
        data: uniqueLogs.map((log) => ({
          sessionId: session.id,
          exerciseId: log.exerciseId,
          setNumber: log.setNumber,
          weightKg: log.weightKg,
          done: true,
        })),
      });
    }

    return { sessionId: session.id, savedSetLogs: uniqueLogs.length };
  });

  return NextResponse.json({ ok: true, ...result });
}