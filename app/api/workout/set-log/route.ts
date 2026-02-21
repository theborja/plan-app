import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveTrainingDayFromDb } from "@/lib/services/dayResolvers";
import { ensureUserSettings, getActivePlanWithRelations } from "@/lib/services/planService";
import { isIsoDate, jsonError, requireAuth } from "@/lib/serverApi";

type Body = {
  dateISO?: string;
  exerciseId?: string;
  setNumber?: number;
  weightKg?: number | null;
  repsDone?: number | null;
  done?: boolean | null;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Body;
  const dateISO = body.dateISO ?? "";
  const exerciseId = (body.exerciseId ?? "").trim();
  const setNumber = Number(body.setNumber ?? 0);

  if (!isIsoDate(dateISO)) return jsonError("dateISO invalido. Usa YYYY-MM-DD.", 400);
  if (!exerciseId) return jsonError("exerciseId es obligatorio.", 400);
  if (!Number.isInteger(setNumber) || setNumber <= 0) return jsonError("setNumber invalido.", 400);

  const userId = auth.user!.id;
  const activePlan = await getActivePlanWithRelations(userId);
  if (!activePlan) return jsonError("No hay plan activo.", 400);

  const exercise = activePlan.trainingDays.flatMap((day) => day.exercises).find((item) => item.id === exerciseId);
  if (!exercise) return jsonError("exerciseId no pertenece al plan activo.", 400);

  const settings = await ensureUserSettings(userId, null);
  const trainingDay = resolveTrainingDayFromDb(
    activePlan.trainingDays.map((day) => ({ id: day.id, dayIndex: day.dayIndex, label: day.label })),
    dateISO,
    settings.trainingDays,
  );
  if (!trainingDay) return jsonError("No hay entrenamiento asignado para esa fecha.", 400);

  const session = await prisma.workoutSession.upsert({
    where: { userId_dateISO: { userId, dateISO } },
    create: {
      userId,
      planId: activePlan.id,
      trainingDayId: trainingDay.id,
      dateISO,
      note: "",
    },
    update: {
      planId: activePlan.id,
      trainingDayId: trainingDay.id,
    },
  });

  const saved = await prisma.exerciseSetLog.upsert({
    where: {
      sessionId_exerciseId_setNumber: {
        sessionId: session.id,
        exerciseId,
        setNumber,
      },
    },
    create: {
      sessionId: session.id,
      exerciseId,
      setNumber,
      weightKg: typeof body.weightKg === "number" ? body.weightKg : null,
      repsDone: typeof body.repsDone === "number" ? body.repsDone : null,
      done: typeof body.done === "boolean" ? body.done : null,
    },
    update: {
      weightKg: typeof body.weightKg === "number" ? body.weightKg : null,
      repsDone: typeof body.repsDone === "number" ? body.repsDone : null,
      done: typeof body.done === "boolean" ? body.done : null,
    },
  });

  return NextResponse.json({ ok: true, setLog: saved });
}