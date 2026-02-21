import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveTrainingDayFromDb } from "@/lib/services/dayResolvers";
import { ensureUserSettings, getActivePlanWithRelations } from "@/lib/services/planService";
import { isIsoDate, jsonError, requireAuth } from "@/lib/serverApi";

type BackupSet = {
  setNumber: number;
  weightKg: number | null;
  repsDone?: number | null;
  done?: boolean | null;
};

type BackupExercise = {
  exerciseIndex: number;
  exerciseName: string;
  sets: BackupSet[];
};

type BackupEntry = {
  dateISO: string;
  note: string;
  trainingDayLabel: string;
  exercises: BackupExercise[];
};

type BackupPayload = {
  version: 1;
  source: "workout_backup_v1";
  exportedAtISO: string;
  entries: BackupEntry[];
};

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseImportPayload(value: unknown): BackupPayload {
  if (!isRecord(value)) {
    throw new Error("JSON invalido.");
  }
  if (value.version !== 1 || value.source !== "workout_backup_v1") {
    throw new Error("Formato no compatible. Se esperaba workout_backup_v1.");
  }
  if (!Array.isArray(value.entries)) {
    throw new Error("El campo entries es obligatorio.");
  }

  const entries: BackupEntry[] = value.entries
    .filter((item) => isRecord(item))
    .map((item) => ({
      dateISO: String(item.dateISO ?? ""),
      note: String(item.note ?? ""),
      trainingDayLabel: String(item.trainingDayLabel ?? ""),
      exercises: Array.isArray(item.exercises)
        ? item.exercises
            .filter((exercise) => isRecord(exercise))
            .map((exercise) => ({
              exerciseIndex: Number(exercise.exerciseIndex ?? -1),
              exerciseName: String(exercise.exerciseName ?? ""),
              sets: Array.isArray(exercise.sets)
                ? exercise.sets
                    .filter((setItem) => isRecord(setItem))
                    .map((setItem) => ({
                      setNumber: Number(setItem.setNumber ?? 0),
                      weightKg:
                        setItem.weightKg === null || setItem.weightKg === undefined
                          ? null
                          : Number(setItem.weightKg),
                      repsDone:
                        setItem.repsDone === undefined || setItem.repsDone === null
                          ? null
                          : Number(setItem.repsDone),
                      done:
                        setItem.done === undefined || setItem.done === null
                          ? null
                          : Boolean(setItem.done),
                    }))
                : [],
            }))
        : [],
    }))
    .filter((entry) => isIsoDate(entry.dateISO));

  return {
    version: 1,
    source: "workout_backup_v1",
    exportedAtISO: String(value.exportedAtISO ?? new Date().toISOString()),
    entries,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const sessions = await prisma.workoutSession.findMany({
    where: { userId: auth.user!.id },
    orderBy: [{ dateISO: "asc" }],
    include: {
      trainingDay: {
        include: {
          exercises: {
            orderBy: [{ exerciseIndex: "asc" }],
          },
        },
      },
      setLogs: {
        orderBy: [{ exerciseId: "asc" }, { setNumber: "asc" }],
      },
    },
  });

  const payload: BackupPayload = {
    version: 1,
    source: "workout_backup_v1",
    exportedAtISO: new Date().toISOString(),
    entries: sessions.map((session) => ({
      dateISO: session.dateISO,
      note: session.note ?? "",
      trainingDayLabel: session.trainingDay.label,
      exercises: session.trainingDay.exercises.map((exercise) => ({
        exerciseIndex: exercise.exerciseIndex,
        exerciseName: exercise.name,
        sets: session.setLogs
          .filter((log) => log.exerciseId === exercise.id)
          .map((log) => ({
            setNumber: log.setNumber,
            weightKg: log.weightKg,
            repsDone: log.repsDone,
            done: log.done,
          })),
      })),
    })),
  };

  return NextResponse.json({ ok: true, backup: payload });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const body = (await request.json().catch(() => ({}))) as { backup?: unknown };

  let backup: BackupPayload;
  try {
    backup = parseImportPayload(body.backup);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "JSON invalido.", 400);
  }

  const userId = auth.user!.id;
  const activePlan = await getActivePlanWithRelations(userId);
  if (!activePlan) {
    return jsonError("No hay plan activo para restaurar entrenos.", 400);
  }

  const settings = await ensureUserSettings(userId, null);
  const sortedEntries = backup.entries.slice().sort((a, b) => a.dateISO.localeCompare(b.dateISO));

  let insertedDays = 0;
  let skippedExistingDays = 0;
  let skippedInvalidDays = 0;
  let insertedSetLogs = 0;

  for (const entry of sortedEntries) {
    if (!isIsoDate(entry.dateISO)) {
      skippedInvalidDays += 1;
      continue;
    }

    const alreadyExists = await prisma.workoutSession.findUnique({
      where: { userId_dateISO: { userId, dateISO: entry.dateISO } },
      select: { id: true },
    });
    if (alreadyExists) {
      skippedExistingDays += 1;
      continue;
    }

    const trainingDay = resolveTrainingDayFromDb(
      activePlan.trainingDays.map((day) => ({ id: day.id, dayIndex: day.dayIndex, label: day.label })),
      entry.dateISO,
      settings.trainingDays,
    );
    if (!trainingDay) {
      skippedInvalidDays += 1;
      continue;
    }

    const fullDay = activePlan.trainingDays.find((day) => day.id === trainingDay.id)!;
    const exerciseByIndex = new Map(fullDay.exercises.map((exercise) => [exercise.exerciseIndex, exercise]));
    const exerciseByName = new Map(fullDay.exercises.map((exercise) => [normalizeToken(exercise.name), exercise]));

    const session = await prisma.workoutSession.create({
      data: {
        userId,
        planId: activePlan.id,
        trainingDayId: trainingDay.id,
        dateISO: entry.dateISO,
        note: entry.note ?? "",
      },
    });
    insertedDays += 1;

    const setRows: Array<{
      sessionId: string;
      exerciseId: string;
      setNumber: number;
      weightKg: number | null;
      repsDone: number | null;
      done: boolean | null;
    }> = [];

    for (const backupExercise of entry.exercises) {
      const matchedExercise =
        exerciseByIndex.get(backupExercise.exerciseIndex) ??
        exerciseByName.get(normalizeToken(backupExercise.exerciseName));
      if (!matchedExercise) continue;

      const dedup = new Map<number, BackupSet>();
      for (const setItem of backupExercise.sets) {
        if (!Number.isInteger(setItem.setNumber) || setItem.setNumber <= 0) continue;
        if (setItem.weightKg !== null && !Number.isFinite(setItem.weightKg)) continue;
        dedup.set(setItem.setNumber, setItem);
      }

      for (const [setNumber, setItem] of dedup.entries()) {
        setRows.push({
          sessionId: session.id,
          exerciseId: matchedExercise.id,
          setNumber,
          weightKg: setItem.weightKg,
          repsDone:
            setItem.repsDone === null || setItem.repsDone === undefined || !Number.isFinite(setItem.repsDone)
              ? null
              : Math.trunc(setItem.repsDone),
          done: typeof setItem.done === "boolean" ? setItem.done : null,
        });
      }
    }

    if (setRows.length > 0) {
      await prisma.exerciseSetLog.createMany({
        data: setRows,
        skipDuplicates: true,
      });
      insertedSetLogs += setRows.length;
    }
  }

  return NextResponse.json({
    ok: true,
    report: {
      totalEntries: sortedEntries.length,
      insertedDays,
      skippedExistingDays,
      skippedInvalidDays,
      insertedSetLogs,
    },
  });
}
