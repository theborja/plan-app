import { NextRequest, NextResponse } from "next/server";
import { badRequest, isISODate, requireAuthUser } from "@/lib/apiRoute";
import { saveWorkoutSetLog } from "@/lib/services/workoutService";

type SetLogBody = {
  dateISO?: string;
  exerciseId?: string;
  setNumber?: number;
  weight?: number | null;
  repsDone?: number | null;
  done?: boolean | null;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;

  const body = (await request.json().catch(() => ({}))) as SetLogBody;
  if (!isISODate(body.dateISO ?? "")) {
    return badRequest("dateISO invalido.");
  }

  if (!body.exerciseId || typeof body.exerciseId !== "string") {
    return badRequest("exerciseId es obligatorio.");
  }

  if (!Number.isInteger(body.setNumber) || (body.setNumber as number) < 1) {
    return badRequest("setNumber invalido.");
  }

  const setLog = await saveWorkoutSetLog({
    userId: auth.user.id,
    dateISO: body.dateISO as string,
    exerciseId: body.exerciseId,
    setNumber: body.setNumber as number,
    weight: typeof body.weight === "number" && Number.isFinite(body.weight) ? body.weight : null,
    repsDone: typeof body.repsDone === "number" && Number.isFinite(body.repsDone) ? body.repsDone : null,
    done: typeof body.done === "boolean" ? body.done : null,
  });

  return NextResponse.json({ ok: true, setLog });
}

