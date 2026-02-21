import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isIsoDate, jsonError, requireAuth } from "@/lib/serverApi";

type Body = {
  weekStartISO?: string;
  weightKg?: number | null;
  neckCm?: number | null;
  armCm?: number | null;
  waistCm?: number | null;
  abdomenCm?: number | null;
  hipCm?: number | null;
  thighCm?: number | null;
  note?: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const weekStartISO = request.nextUrl.searchParams.get("weekStartISO") ?? "";
  if (weekStartISO && !isIsoDate(weekStartISO)) {
    return jsonError("weekStartISO invalido. Usa YYYY-MM-DD.", 400);
  }

  if (weekStartISO) {
    const row = await prisma.weeklyMeasure.findUnique({
      where: { userId_weekStartISO: { userId: auth.user!.id, weekStartISO } },
    });
    return NextResponse.json({ ok: true, row });
  }

  const rows = await prisma.weeklyMeasure.findMany({
    where: { userId: auth.user!.id },
    orderBy: { weekStartISO: "asc" },
  });

  return NextResponse.json({ ok: true, rows });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Body;
  const weekStartISO = body.weekStartISO ?? "";
  if (!isIsoDate(weekStartISO)) {
    return jsonError("weekStartISO invalido. Usa YYYY-MM-DD.", 400);
  }

  const payload = {
    weightKg: typeof body.weightKg === "number" ? body.weightKg : null,
    neckCm: typeof body.neckCm === "number" ? body.neckCm : null,
    armCm: typeof body.armCm === "number" ? body.armCm : null,
    waistCm: typeof body.waistCm === "number" ? body.waistCm : null,
    abdomenCm: typeof body.abdomenCm === "number" ? body.abdomenCm : null,
    hipCm: typeof body.hipCm === "number" ? body.hipCm : null,
    thighCm: typeof body.thighCm === "number" ? body.thighCm : null,
    note: body.note ?? null,
  };

  const row = await prisma.weeklyMeasure.upsert({
    where: { userId_weekStartISO: { userId: auth.user!.id, weekStartISO } },
    create: {
      userId: auth.user!.id,
      weekStartISO,
      ...payload,
    },
    update: payload,
  });

  return NextResponse.json({ ok: true, row });
}