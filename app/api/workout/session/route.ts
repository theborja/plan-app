import { NextRequest, NextResponse } from "next/server";
import { badRequest, isISODate, requireAuthUser } from "@/lib/apiRoute";
import { saveWorkoutSession } from "@/lib/services/workoutService";

type SessionBody = {
  dateISO?: string;
  trainingDayId?: string;
  note?: string;
  completed?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;

  const body = (await request.json().catch(() => ({}))) as SessionBody;
  if (!isISODate(body.dateISO ?? "")) {
    return badRequest("dateISO invalido.");
  }

  const session = await saveWorkoutSession({
    userId: auth.user.id,
    dateISO: body.dateISO as string,
    trainingDayId: typeof body.trainingDayId === "string" ? body.trainingDayId : undefined,
    note: typeof body.note === "string" ? body.note : "",
    completed: Boolean(body.completed),
  });

  return NextResponse.json({ ok: true, session });
}

