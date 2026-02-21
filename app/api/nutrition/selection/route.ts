import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActivePlanWithRelations } from "@/lib/services/planService";
import { isIsoDate, jsonError, requireAuth } from "@/lib/serverApi";

type Body = {
  dateISO?: string;
  selectedDayOptionId?: string | null;
  done?: boolean;
  note?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Body;
  const dateISO = body.dateISO ?? "";
  if (!isIsoDate(dateISO)) {
    return jsonError("dateISO invalido. Usa YYYY-MM-DD.", 400);
  }

  const activePlan = await getActivePlanWithRelations(auth.user!.id);
  if (!activePlan) {
    return jsonError("No hay plan activo.", 400);
  }

  if (body.selectedDayOptionId) {
    const optionExists = activePlan.nutritionDays.some((day) =>
      day.mealOptions.some((option) => option.id === body.selectedDayOptionId),
    );
    if (!optionExists) {
      return jsonError("selectedDayOptionId no pertenece al plan activo.", 400);
    }
  }

  const saved = await prisma.mealSelectionLog.upsert({
    where: { userId_dateISO: { userId: auth.user!.id, dateISO } },
    create: {
      userId: auth.user!.id,
      planId: activePlan.id,
      dateISO,
      selectedDayOptionId: body.selectedDayOptionId ?? null,
      done: body.done ?? false,
      note: body.note ?? "",
    },
    update: {
      planId: activePlan.id,
      selectedDayOptionId: body.selectedDayOptionId ?? null,
      done: body.done ?? false,
      note: body.note ?? "",
    },
  });

  return NextResponse.json({ ok: true, selection: saved });
}