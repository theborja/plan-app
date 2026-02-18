import { NextRequest, NextResponse } from "next/server";
import { badRequest, isISODate, requireAuthUser } from "@/lib/apiRoute";
import { getWorkoutForDate } from "@/lib/services/workoutService";

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;

  const dateISO = request.nextUrl.searchParams.get("date") ?? "";
  if (!isISODate(dateISO)) {
    return badRequest("Parametro date invalido. Usa YYYY-MM-DD.");
  }

  const workout = await getWorkoutForDate(auth.user.id, dateISO);
  return NextResponse.json({ ok: true, workout });
}

