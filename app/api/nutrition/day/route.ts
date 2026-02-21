import { NextRequest, NextResponse } from "next/server";
import { MealType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveNutritionDayFromDb } from "@/lib/services/dayResolvers";
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
    return NextResponse.json({ ok: true, day: null, selection: null });
  }

  const cycleWeeks = Math.max(1, Math.max(...activePlan.nutritionDays.map((day) => day.weekIndex), 1));
  const nutritionDay = resolveNutritionDayFromDb(
    activePlan.nutritionDays.map((day) => ({ id: day.id, weekIndex: day.weekIndex, dayOfWeek: day.dayOfWeek })),
    dateISO,
    settings.nutritionStartDateISO,
    cycleWeeks,
  );

  if (!nutritionDay) {
    return NextResponse.json({ ok: true, day: null, selection: null });
  }

  const fullDay = activePlan.nutritionDays.find((item) => item.id === nutritionDay.id)!;
  const selection = await prisma.mealSelectionLog.findUnique({
    where: { userId_dateISO: { userId, dateISO } },
  });

  const meals: Record<MealType, Array<{ id: string; title: string; lines: string[] }>> = {
    DESAYUNO: [],
    ALMUERZO: [],
    COMIDA: [],
    MERIENDA: [],
    CENA: [],
    POSTRE: [],
  };

  for (const option of fullDay.mealOptions) {
    meals[option.mealType].push({
      id: option.id,
      title: option.title,
      lines: option.lines.map((line) => line.content),
    });
  }

  return NextResponse.json({
    ok: true,
    day: {
      id: fullDay.id,
      weekIndex: fullDay.weekIndex,
      dayOfWeek: fullDay.dayOfWeek,
      meals,
    },
    selection: selection
      ? {
          selectedDayOptionId: selection.selectedDayOptionId,
          done: selection.done,
          note: selection.note ?? "",
          updatedAt: selection.updatedAt,
        }
      : null,
  });
}