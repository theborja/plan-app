import { prisma } from "@/lib/db";

export type WeeklyMeasurePayload = {
  weekStartISO: string;
  weightKg?: number | null;
  neckCm?: number | null;
  armCm?: number | null;
  waistCm?: number | null;
  abdomenCm?: number | null;
  hipCm?: number | null;
  thighCm?: number | null;
  note?: string | null;
};

export async function getWeeklyMeasure(userId: string, weekStartISO: string) {
  return prisma.weeklyMeasureLog.findUnique({
    where: {
      userId_weekStartISO: {
        userId,
        weekStartISO,
      },
    },
  });
}

export async function listWeeklyMeasures(userId: string) {
  return prisma.weeklyMeasureLog.findMany({
    where: { userId },
    orderBy: { weekStartISO: "asc" },
  });
}

export async function saveWeeklyMeasure(userId: string, payload: WeeklyMeasurePayload) {
  return prisma.weeklyMeasureLog.upsert({
    where: {
      userId_weekStartISO: {
        userId,
        weekStartISO: payload.weekStartISO,
      },
    },
    update: {
      weightKg: payload.weightKg ?? null,
      neckCm: payload.neckCm ?? null,
      armCm: payload.armCm ?? null,
      waistCm: payload.waistCm ?? null,
      abdomenCm: payload.abdomenCm ?? null,
      hipCm: payload.hipCm ?? null,
      thighCm: payload.thighCm ?? null,
      note: payload.note ?? null,
    },
    create: {
      userId,
      weekStartISO: payload.weekStartISO,
      weightKg: payload.weightKg ?? null,
      neckCm: payload.neckCm ?? null,
      armCm: payload.armCm ?? null,
      waistCm: payload.waistCm ?? null,
      abdomenCm: payload.abdomenCm ?? null,
      hipCm: payload.hipCm ?? null,
      thighCm: payload.thighCm ?? null,
      note: payload.note ?? null,
    },
  });
}

