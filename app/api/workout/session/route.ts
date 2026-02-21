import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveTrainingDayFromDb } from "@/lib/services/dayResolvers";
import { ensureUserSettings, getActivePlanWithRelations } from "@/lib/services/planService";
import { isIsoDate, jsonError, requireAuth } from "@/lib/serverApi";

type Body = {
  dateISO?: string;
  note?: string;
  doneExerciseIndexes?: number[];
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Body;
  const dateISO = body.dateISO ?? "";
  if (!isIsoDate(dateISO)) {
    return jsonError("dateISO invalido. Usa YYYY-MM-DD.", 400);
  }

  const userId = auth.user!.id;
  const activePlan = await getActivePlanWithRelations(userId);
  if (!activePlan) return jsonError("No hay plan activo.", 400);

  const settings = await ensureUserSettings(userId, null);
  const trainingDay = resolveTrainingDayFromDb(
    activePlan.trainingDays.map((day) => ({ id: day.id, dayIndex: day.dayIndex, label: day.label })),
    dateISO,
    settings.trainingDays,
  );

  if (!trainingDay) {
    return jsonError("No hay entrenamiento asignado para esa fecha.", 400);
  }

  const saved = await prisma.workoutSession.upsert({
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

  return NextResponse.json({ ok: true, session: saved });
}