import type { DayOfWeek, MealType, MenuOption, NutritionDay, NutritionPlan } from "@/lib/types";

const ORDERED_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEAL_TYPES: MealType[] = [
  "DESAYUNO",
  "ALMUERZO",
  "COMIDA",
  "MERIENDA",
  "CENA",
  "POSTRE",
];

type DayColumnMatch = { colIndex: number; dayOfWeek: DayOfWeek };
type WeekColumnMap = Record<DayOfWeek, number>;
type MealBlock = { mealType: MealType; startRow: number; endRow: number };

export type ParsePlanNutricionalDebug = {
  headerRowIndex?: number;
  week1Columns?: WeekColumnMap;
  week2Columns?: WeekColumnMap;
  mealBlocks?: Array<{ mealType: MealType; startRow: number; endRow: number }>;
};

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function asCellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const maybe = value as { w?: unknown; v?: unknown };
    if (typeof maybe.w === "string") return maybe.w;
    if (typeof maybe.v === "string") return maybe.v;
    if (typeof maybe.v === "number" || typeof maybe.v === "boolean") return String(maybe.v);
  }
  return "";
}

function parseDayFromHeaderCell(value: string): DayOfWeek | null {
  const token = normalizeToken(value);
  if (!token) return null;

  const map: Record<string, DayOfWeek> = {
    MON: "Mon",
    MONDAY: "Mon",
    LUNES: "Mon",
    TUE: "Tue",
    TUESDAY: "Tue",
    MARTES: "Tue",
    WED: "Wed",
    WEDNESDAY: "Wed",
    MIERCOLES: "Wed",
    JUEVES: "Thu",
    THU: "Thu",
    THURSDAY: "Thu",
    VIERNES: "Fri",
    FRI: "Fri",
    FRIDAY: "Fri",
    SABADO: "Sat",
    SAT: "Sat",
    SATURDAY: "Sat",
    DOMINGO: "Sun",
    SUN: "Sun",
    SUNDAY: "Sun",
  };

  return map[token] ?? null;
}

function findHeaderRow(sheetMatrix: unknown[][]): {
  headerRowIndex: number;
  dayMatches: DayColumnMatch[];
} {
  let best: { headerRowIndex: number; dayMatches: DayColumnMatch[] } | null = null;

  for (let rowIndex = 0; rowIndex < sheetMatrix.length; rowIndex += 1) {
    const row = sheetMatrix[rowIndex] ?? [];
    const dayMatches: DayColumnMatch[] = [];

    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const dayOfWeek = parseDayFromHeaderCell(asCellText(row[colIndex]));
      if (dayOfWeek) {
        dayMatches.push({ colIndex, dayOfWeek });
      }
    }

    if (dayMatches.length < 7) continue;

    if (!best || dayMatches.length > best.dayMatches.length) {
      best = { headerRowIndex: rowIndex, dayMatches };
    }
  }

  if (!best) {
    throw new Error('No header row found with "LUNES..DOMINGO".');
  }

  return best;
}

function pickWeekColumns(matches: DayColumnMatch[], minCol: number): WeekColumnMap | null {
  const weekColumns = {} as WeekColumnMap;
  let cursor = minCol;

  for (const day of ORDERED_DAYS) {
    const match = matches.find((item) => item.dayOfWeek === day && item.colIndex > cursor);
    if (!match) {
      return null;
    }
    weekColumns[day] = match.colIndex;
    cursor = match.colIndex;
  }

  return weekColumns;
}

function detectWeekColumns(dayMatches: DayColumnMatch[]): {
  week1Columns: WeekColumnMap;
  week2Columns: WeekColumnMap;
} {
  const sorted = [...dayMatches].sort((a, b) => a.colIndex - b.colIndex);
  const week1Columns = pickWeekColumns(sorted, -1);
  if (!week1Columns) {
    throw new Error("Could not detect week 1 columns.");
  }

  const week2Columns = pickWeekColumns(sorted, week1Columns.Sun);
  if (!week2Columns) {
    throw new Error("Could not detect week 2 columns.");
  }

  return { week1Columns, week2Columns };
}

function detectMealType(value: string): MealType | null {
  const token = normalizeToken(value);
  if (!token) return null;

  if (token.includes("DESAYUNO")) return "DESAYUNO";
  if (token.includes("ALMUERZO")) return "ALMUERZO";
  if (token.includes("COMIDA")) return "COMIDA";
  if (token.includes("MERIENDA")) return "MERIENDA";
  if (token.includes("CENA")) return "CENA";
  if (token.includes("POSTRE")) return "POSTRE";
  return null;
}

function detectMealBlocks(sheetMatrix: unknown[][], fromRowIndex: number): MealBlock[] {
  const starts: Array<{ mealType: MealType; startRow: number }> = [];

  for (let rowIndex = fromRowIndex; rowIndex < sheetMatrix.length; rowIndex += 1) {
    const row = sheetMatrix[rowIndex] ?? [];
    const mealType = detectMealType(asCellText(row[0]));
    if (mealType) {
      starts.push({ mealType, startRow: rowIndex });
    }
  }

  return starts.map((start, index) => {
    const next = starts[index + 1];
    return {
      mealType: start.mealType,
      startRow: start.startRow,
      endRow: next ? next.startRow - 1 : sheetMatrix.length - 1,
    };
  });
}

function collectCellTextByBlock(
  sheetMatrix: unknown[][],
  block: MealBlock,
  colIndex: number,
): string {
  const lines: string[] = [];
  for (let row = block.startRow; row <= block.endRow; row += 1) {
    const rowCells = sheetMatrix[row] ?? [];
    const text = asCellText(rowCells[colIndex]).trim();
    if (text) {
      lines.push(text);
    }
  }
  return lines.join("\n");
}

function cleanLines(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .map((line) => line.replace(/^[\-\*\u2022]+\s*/, "").trim())
    .filter((line) => line.length > 0);
}

function splitByHeaders(lines: string[]): string[][] {
  const output: string[][] = [];
  let current: string[] = [];
  const headerRegex =
    /(OPCI(?:ON|\u00d3N)\s*\d*|MEN(?:U|\u00da)\s*\d+)\s*[:\-\.)]?\s*(.*)$/i;

  for (const line of lines) {
    const normalized = normalizeToken(line);
    const hasHeader = normalized.includes("OPCION") || /MEN[U]\s*\d+/.test(normalized);

    if (hasHeader) {
      if (current.length > 0) {
        output.push(current);
      }
      current = [];
      const match = line.match(headerRegex);
      const maybeRemainder = (match?.[2] ?? "").trim();
      if (maybeRemainder) {
        current.push(maybeRemainder);
      }
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    output.push(current);
  }

  return output;
}

function splitByEnumeration(lines: string[]): string[][] {
  const output: string[][] = [];
  let current: string[] = [];
  const enumRegex = /^(\d+)\s*[\)\.:-]\s*(.*)$/;

  for (const line of lines) {
    const match = line.match(enumRegex);
    if (match) {
      if (current.length > 0) {
        output.push(current);
      }
      current = [];
      const firstLine = (match[2] ?? "").trim();
      if (firstLine) {
        current.push(firstLine);
      }
      continue;
    }

    current.push(line);
  }

  if (current.length > 0) {
    output.push(current);
  }

  return output;
}

export function splitIntoOptions(text: string): string[][] {
  const preprocessed = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/(OPCI(?:ON|\u00d3N)\s*\d*|MEN(?:U|\u00da)\s*\d+)/gi, "\n$1")
    .replace(/(\d+\s*[\)\.])/g, "\n$1");

  const lines = cleanLines(preprocessed.split("\n"));
  if (lines.length === 0) return [];

  const hasHeaderSeparators = lines.some((line) => {
    const normalized = normalizeToken(line);
    return normalized.includes("OPCION") || /MENU\s*\d+/.test(normalized);
  });

  if (hasHeaderSeparators) {
    const byHeaders = splitByHeaders(lines).map(cleanLines).filter((chunk) => chunk.length > 0);
    if (byHeaders.length > 0) return byHeaders;
  }

  const hasEnumerationSeparators = lines.some((line) => /^(\d+)\s*[\)\.:-]\s*/.test(line));
  if (hasEnumerationSeparators) {
    const byEnum = splitByEnumeration(lines).map(cleanLines).filter((chunk) => chunk.length > 0);
    if (byEnum.length > 0) return byEnum;
  }

  return [lines];
}

function buildMenuOptions(
  text: string,
  weekIndex: 1 | 2,
  dayOfWeek: DayOfWeek,
  mealType: MealType,
): MenuOption[] {
  const chunks = splitIntoOptions(text);
  return chunks.map((lines, index) => {
    const n = index + 1;
    const firstLine = lines.find((line) => line.trim().length > 0);
    const title = firstLine ? firstLine.slice(0, 60) : `Opcion ${n}`;

    return {
      optionId: `${weekIndex}-${dayOfWeek}-${mealType}-${n}`,
      title,
      lines,
    };
  });
}

export function parsePlanNutricional(
  sheetMatrix: unknown[][],
  debug?: ParsePlanNutricionalDebug,
): NutritionPlan {
  const { headerRowIndex, dayMatches } = findHeaderRow(sheetMatrix);
  const { week1Columns, week2Columns } = detectWeekColumns(dayMatches);
  const mealBlocks = detectMealBlocks(sheetMatrix, headerRowIndex + 1);
  const mealByType = new Map<MealType, MealBlock>();

  for (const block of mealBlocks) {
    if (!mealByType.has(block.mealType)) {
      mealByType.set(block.mealType, block);
    }
  }

  if (debug) {
    debug.headerRowIndex = headerRowIndex;
    debug.week1Columns = week1Columns;
    debug.week2Columns = week2Columns;
    debug.mealBlocks = mealBlocks.map((block) => ({
      mealType: block.mealType,
      startRow: block.startRow,
      endRow: block.endRow,
    }));
  }

  const days: NutritionDay[] = [];

  for (const weekIndex of [1, 2] as const) {
    const columns = weekIndex === 1 ? week1Columns : week2Columns;

    for (const dayOfWeek of ORDERED_DAYS) {
      const meals = {
        DESAYUNO: [] as MenuOption[],
        ALMUERZO: [] as MenuOption[],
        COMIDA: [] as MenuOption[],
        MERIENDA: [] as MenuOption[],
        CENA: [] as MenuOption[],
        POSTRE: [] as MenuOption[],
      };

      for (const mealType of MEAL_TYPES) {
        const block = mealByType.get(mealType);
        if (!block) {
          continue;
        }

        const cellText = collectCellTextByBlock(sheetMatrix, block, columns[dayOfWeek]);
        if (!cellText.trim()) {
          continue;
        }

        meals[mealType] = buildMenuOptions(cellText, weekIndex, dayOfWeek, mealType);
      }

      days.push({
        weekIndex,
        dayOfWeek,
        meals,
      });
    }
  }

  return {
    cycleWeeks: 2,
    days,
  };
}
