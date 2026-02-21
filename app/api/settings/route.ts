import { DayOfWeek } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureUserSettings } from "@/lib/services/planService";
import { isIsoDate, jsonError, requireAuth } from "@/lib/serverApi";

type Body = {
  nutritionStartDateISO?: string;
  trainingDays?: DayOfWeek[];
};

const VALID_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const settings = await ensureUserSettings(auth.user!.id, null);
  return NextResponse.json({ ok: true, settings });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as Body;
  if (!body.nutritionStartDateISO || !isIsoDate(body.nutritionStartDateISO)) {
    return jsonError("nutritionStartDateISO invalido.", 400);
  }

  const trainingDays = Array.isArray(body.trainingDays)
    ? body.trainingDays.filter((day): day is DayOfWeek => VALID_DAYS.includes(day))
    : [];

  if (trainingDays.length === 0) {
    return jsonError("trainingDays debe contener al menos un dia.", 400);
  }

  const uniqueDays = [...new Set(trainingDays)];

  const settings = await prisma.userSettings.upsert({
    where: { userId: auth.user!.id },
    create: {
      userId: auth.user!.id,
      nutritionStartDateISO: body.nutritionStartDateISO,
      trainingDays: uniqueDays,
    },
    update: {
      nutritionStartDateISO: body.nutritionStartDateISO,
      trainingDays: uniqueDays,
    },
  });

  return NextResponse.json({ ok: true, settings });
}