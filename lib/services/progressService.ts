import { prisma } from "@/lib/db";
import { getActivePlanForUser } from "@/lib/services/planService";

type ProgressPoint = {
  isoDate: string;
  weightKg: number;
};

function parseIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((acc, value) => acc + value, 0) / values.length);
}

function sum(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((acc, value) => acc + value, 0));
}

function computeDeltaFromDays(points: ProgressPoint[], daysBack: number): { pct: number | null; kg: number | null } {
  if (points.length < 2) return { pct: null, kg: null };
  const latest = points[points.length - 1];
  const latestDate = parseIsoDate(latest.isoDate);
  const threshold = new Date(latestDate);
  threshold.setDate(threshold.getDate() - daysBack);

  let reference: ProgressPoint | null = null;
  for (let idx = points.length - 2; idx >= 0; idx -= 1) {
    const point = points[idx];
    if (parseIsoDate(point.isoDate) <= threshold) {
      reference = point;
      break;
    }
  }

  if (!reference) return { pct: null, kg: null };
  const kg = latest.weightKg - reference.weightKg;
  if (reference.weightKg === 0) return { pct: null, kg: round1(kg) };
  const pct = (kg / reference.weightKg) * 100;
  return { pct: round1(pct), kg: round1(kg) };
}

function cleanBlockName(label: string): string {
  return label.replace(/^D[ÍI]A\s*\d+\s*[-:]\s*/i, "").trim() || label.trim();
}

function buildBlockId(planId: string, dayIndex: number): string {
  return `block-${planId}-${dayIndex}`;
}

function parseBlockId(blockId: string): { planId: string; dayIndex: number } | null {
  const prefix = "block-";
  if (!blockId.startsWith(prefix)) return null;
  const rest = blockId.slice(prefix.length);
  const lastSep = rest.lastIndexOf("-");
  if (lastSep <= 0) return null;
  const planId = rest.slice(0, lastSep);
  const dayIndexRaw = rest.slice(lastSep + 1);
  const dayIndex = Number(dayIndexRaw);
  if (!Number.isInteger(dayIndex) || dayIndex <= 0) return null;
  return { planId, dayIndex };
}

export async function getProgressBlocks(userId: string) {
  const activePlan = await getActivePlanForUser(userId);
  if (!activePlan) return [];

  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      planId: activePlan.id,
    },
    include: {
      trainingDay: {
        include: {
          exercises: true,
        },
      },
      setLogs: {
        include: {
          exercise: true,
        },
      },
    },
    orderBy: { dateISO: "asc" },
  });

  const trainingDays = activePlan.trainingDays.slice().sort((a, b) => a.dayIndex - b.dayIndex);

  return trainingDays.map((day) => {
    const blockId = buildBlockId(activePlan.id, day.dayIndex);
    const daySessions = sessions.filter((session) => session.trainingDayId === day.id);

    const exercises = day.exercises
      .slice()
      .sort((a, b) => a.exerciseIndex - b.exerciseIndex)
      .map((exercise) => {
        const points: ProgressPoint[] = [];
        for (const session of daySessions) {
          const weights = session.setLogs
            .filter((setLog) => setLog.exerciseId === exercise.id && typeof setLog.weight === "number")
            .map((setLog) => setLog.weight as number);
          if (weights.length === 0) continue;
          points.push({
            isoDate: session.dateISO,
            weightKg: Math.max(...weights),
          });
        }

        const weekly = computeDeltaFromDays(points, 7);
        const monthly = computeDeltaFromDays(points, 30);

        return {
          exerciseId: exercise.id,
          exerciseIndex: exercise.exerciseIndex,
          exerciseName: exercise.name,
          points,
          weeklyDeltaPct: weekly.pct,
          monthlyDeltaPct: monthly.pct,
          weeklyDeltaKg: weekly.kg,
          monthlyDeltaKg: monthly.kg,
        };
      });

    const weeklyPcts = exercises.map((exercise) => exercise.weeklyDeltaPct).filter((value): value is number => value !== null);
    const monthlyPcts = exercises.map((exercise) => exercise.monthlyDeltaPct).filter((value): value is number => value !== null);
    const weeklyKgs = exercises.map((exercise) => exercise.weeklyDeltaKg).filter((value): value is number => value !== null);
    const monthlyKgs = exercises.map((exercise) => exercise.monthlyDeltaKg).filter((value): value is number => value !== null);

    return {
      blockId,
      planId: activePlan.id,
      dayIndex: day.dayIndex,
      blockTabLabel: `Dia ${day.dayIndex}`,
      blockName: cleanBlockName(day.label),
      blockFullLabel: day.label,
      exercises,
      weeklyAvgPct: average(weeklyPcts),
      monthlyAvgPct: average(monthlyPcts),
      weeklyTotalKg: sum(weeklyKgs),
      monthlyTotalKg: sum(monthlyKgs),
    };
  });
}

export async function getProgressBlock(userId: string, blockId: string) {
  const parsed = parseBlockId(blockId);
  if (!parsed) return null;
  const blocks = await getProgressBlocks(userId);
  return blocks.find((block) => block.blockId === blockId) ?? null;
}

