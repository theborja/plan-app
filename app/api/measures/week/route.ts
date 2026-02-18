import { NextRequest, NextResponse } from "next/server";
import { badRequest, isISODate, requireAuthUser } from "@/lib/apiRoute";
import { getWeeklyMeasure, listWeeklyMeasures, saveWeeklyMeasure } from "@/lib/services/measuresService";

type MeasureBody = {
  weekStartISO?: string;
  weightKg?: number | null;
  neckCm?: number | null;
  armCm?: number | null;
  waistCm?: number | null;
  abdomenCm?: number | null;
  hipCm?: number | null;
  thighCm?: number | null;
  note?: string | null;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;

  const weekStartISO = request.nextUrl.searchParams.get("weekStart");
  if (!weekStartISO) {
    const rows = await listWeeklyMeasures(auth.user.id);
    return NextResponse.json({ ok: true, rows });
  }

  if (!isISODate(weekStartISO)) {
    return badRequest("weekStart invalido. Usa YYYY-MM-DD.");
  }

  const row = await getWeeklyMeasure(auth.user.id, weekStartISO);
  return NextResponse.json({ ok: true, row });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;

  const body = (await request.json().catch(() => ({}))) as MeasureBody;
  if (!isISODate(body.weekStartISO ?? "")) {
    return badRequest("weekStartISO invalido. Usa YYYY-MM-DD.");
  }

  const row = await saveWeeklyMeasure(auth.user.id, {
    weekStartISO: body.weekStartISO as string,
    weightKg: typeof body.weightKg === "number" ? body.weightKg : null,
    neckCm: typeof body.neckCm === "number" ? body.neckCm : null,
    armCm: typeof body.armCm === "number" ? body.armCm : null,
    waistCm: typeof body.waistCm === "number" ? body.waistCm : null,
    abdomenCm: typeof body.abdomenCm === "number" ? body.abdomenCm : null,
    hipCm: typeof body.hipCm === "number" ? body.hipCm : null,
    thighCm: typeof body.thighCm === "number" ? body.thighCm : null,
    note: typeof body.note === "string" ? body.note : null,
  });

  return NextResponse.json({ ok: true, row });
}

