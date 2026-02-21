import { NextRequest, NextResponse } from "next/server";
import { ensureUserSettings, getActivePlanWithRelations, toApiPlan } from "@/lib/services/planService";
import { requireAuth } from "@/lib/serverApi";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const userId = auth.user!.id;
  const activePlan = await getActivePlanWithRelations(userId);
  const settings = await ensureUserSettings(userId, null);

  if (!activePlan) {
    return NextResponse.json({
      ok: true,
      plan: null,
      settings: {
        nutritionStartDateISO: settings.nutritionStartDateISO,
        trainingDays: settings.trainingDays,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    plan: toApiPlan(activePlan),
    settings: {
      nutritionStartDateISO: settings.nutritionStartDateISO,
      trainingDays: settings.trainingDays,
    },
  });
}