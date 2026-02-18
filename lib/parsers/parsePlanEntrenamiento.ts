import type { Exercise, TrainingDay, TrainingPlan } from "@/lib/types";

type DayBlock = {
  startRow: number;
  endRow: number;
  dayIndex: number | null;
  label: string;
};

function asCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  if (typeof value === "object") {
    const maybe = value as { w?: unknown; v?: unknown };
    if (typeof maybe.w === "string") return maybe.w.trim();
    if (typeof maybe.v === "string") return maybe.v.trim();
    if (typeof maybe.v === "number" || typeof maybe.v === "boolean") {
      return String(maybe.v).trim();
    }
  }
  return "";
}

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseDayHeader(text: string): { isDayHeader: boolean; dayIndex: number | null } {
  const normalized = normalizeToken(text);
  if (!normalized.startsWith("DIA")) {
    return { isDayHeader: false, dayIndex: null };
  }

  const match = normalized.match(/^DIA\s*(\d+)/);
  if (!match) {
    return { isDayHeader: true, dayIndex: null };
  }

  const parsed = Number(match[1]);
  return {
    isDayHeader: true,
    dayIndex: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
  };
}

function detectDayBlocks(sheetMatrix: unknown[][]): DayBlock[] {
  const starts: Array<{ row: number; dayIndex: number | null; label: string }> = [];

  for (let rowIndex = 0; rowIndex < sheetMatrix.length; rowIndex += 1) {
    const row = sheetMatrix[rowIndex] ?? [];
    const col0 = asCellText(row[0]);
    const header = parseDayHeader(col0);
    if (header.isDayHeader) {
      starts.push({
        row: rowIndex,
        dayIndex: header.dayIndex,
        label: col0 || (header.dayIndex ? `DIA ${header.dayIndex}` : "DIA"),
      });
    }
  }

  return starts.map((start, index) => {
    const next = starts[index + 1];
    return {
      startRow: start.row,
      endRow: next ? next.row - 1 : sheetMatrix.length - 1,
      dayIndex: start.dayIndex,
      label: start.label,
    };
  });
}

function parseSets(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(",", ".").trim();
  const num = Number(cleaned);
  if (Number.isFinite(num) && num > 0) {
    return Math.round(num);
  }
  return null;
}

function parseReps(raw: string): string | null {
  if (!raw) return null;
  return raw.trim();
}

function parseRestSeconds(raw: string): number | null {
  const input = raw.trim();
  if (!input) return null;

  const normalized = input
    .replace(/\s+/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[′’]/g, "'")
    .replace(/[″]/g, '"')
    .toLowerCase();

  // Formato mm'ss" o mm'ss
  const minSecMatch = normalized.match(/^(\d+)'(\d{1,2})(?:"|s|sec|seg)?$/);
  if (minSecMatch) {
    const min = Number(minSecMatch[1]);
    const sec = Number(minSecMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(sec)) {
      return min * 60 + sec;
    }
  }

  // Formato solo minutos: 3' o 3m o 3min
  const minMatch = normalized.match(/^(\d+)(?:'|m|min)$/);
  if (minMatch) {
    const min = Number(minMatch[1]);
    if (Number.isFinite(min)) {
      return min * 60;
    }
  }

  // Formato solo segundos con comillas o sufijo: 180" / 90s / 90sec
  const secMatch = normalized.match(/^(\d+)(?:"|s|sec|seg)?$/);
  if (secMatch) {
    const sec = Number(secMatch[1]);
    if (Number.isFinite(sec)) {
      return sec;
    }
  }

  return null;
}

function collectNotes(row: unknown[]): string | null {
  const noteParts: string[] = [];

  for (let col = 1; col <= 4; col += 1) {
    const text = asCellText(row[col]);
    if (text) noteParts.push(text);
  }

  if (noteParts.length === 0) return null;
  return noteParts.join(" | ");
}

function parseExerciseRow(row: unknown[], dayNumber: number, exerciseOrder: number): Exercise | null {
  const name = asCellText(row[0]);
  if (!name) {
    return null;
  }

  const setsRaw = asCellText(row[5]);
  const repsRaw = asCellText(row[6]);
  const restRaw = asCellText(row[7]);

  if (!setsRaw || !repsRaw || !restRaw) {
    return null;
  }

  const sets = parseSets(setsRaw);
  const reps = parseReps(repsRaw);
  const restSeconds = parseRestSeconds(restRaw);

  if (sets === null || reps === null || restSeconds === null) {
    return null;
  }

  return {
    id: `d${dayNumber}-ex${exerciseOrder}`,
    name,
    series: sets,
    reps,
    restSeconds,
    notes: collectNotes(row),
  };
}

export function parsePlanEntrenamiento(sheetMatrix: unknown[][]): TrainingPlan {
  const blocks = detectDayBlocks(sheetMatrix);
  const parsedDays: Array<{ dayIndex: number; day: TrainingDay }> = [];
  let fallbackDayCounter = 1;

  for (const block of blocks) {
    const dayIndex = block.dayIndex ?? fallbackDayCounter;
    fallbackDayCounter = Math.max(fallbackDayCounter + 1, dayIndex + 1);

    const exercises: Exercise[] = [];
    let exerciseCounter = 1;

    for (let rowIndex = block.startRow + 1; rowIndex <= block.endRow; rowIndex += 1) {
      const row = sheetMatrix[rowIndex] ?? [];
      const exercise = parseExerciseRow(row, dayIndex, exerciseCounter);
      if (exercise) {
        exercises.push(exercise);
        exerciseCounter += 1;
      }
    }

    parsedDays.push({
      dayIndex,
      day: {
        dayIndex,
        day: dayIndex,
        label: block.label || `DIA ${dayIndex}`,
        exercises,
      },
    });
  }

  parsedDays.sort((a, b) => a.dayIndex - b.dayIndex);

  return {
    days: parsedDays.map((item) => item.day),
  };
}
