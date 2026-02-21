import type { DayOfWeek, MealType, MenuOption, NutritionDay, NutritionPlan } from "@/lib/types";

const ORDERED_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DayColumnMatch = { colIndex: number; dayOfWeek: DayOfWeek };
type WeekColumnMap = Record<DayOfWeek, number>;
type MealBlock = { mealType: MealType; startRow: number; endRow: number };
type MainMealType = Exclude<MealType, "POSTRE">;
type MealsByType = Record<MealType, MenuOption[]>;

export type ParsePlanNutricionalDebug = {
  headerRowIndex?: number;
  weekColumns?: WeekColumnMap[];
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

function detectWeekColumns(dayMatches: DayColumnMatch[]): WeekColumnMap[] {
  const sorted = [...dayMatches].sort((a, b) => a.colIndex - b.colIndex);
  const weekColumns: WeekColumnMap[] = [];
  let cursor = -1;

  while (true) {
    const detected = pickWeekColumns(sorted, cursor);
    if (!detected) break;
    weekColumns.push(detected);
    cursor = detected.Sun;
  }

  if (weekColumns.length === 0) {
    throw new Error("Could not detect nutrition day columns.");
  }

  return weekColumns;
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

function isMainMealType(value: MealType): value is MainMealType {
  return value !== "POSTRE";
}

function isObservationsRow(row: unknown[]): boolean {
  const sample = [asCellText(row[0]), asCellText(row[1]), asCellText(row[2])]
    .map((value) => normalizeToken(value))
    .join(" ");

  return sample.includes("OBSERVACIONES") || sample.includes("SUPLEMENTACION");
}

function detectMealBlocks(sheetMatrix: unknown[][], fromRowIndex: number): MealBlock[] {
  const starts: Array<{ mealType: MealType; startRow: number }> = [];
  let scanEndRow = sheetMatrix.length - 1;

  for (let rowIndex = fromRowIndex; rowIndex < sheetMatrix.length; rowIndex += 1) {
    const row = sheetMatrix[rowIndex] ?? [];
    if (isObservationsRow(row)) {
      scanEndRow = rowIndex - 1;
      break;
    }

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
      endRow: next ? next.startRow - 1 : scanEndRow,
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
  weekIndex: number,
  dayOfWeek: DayOfWeek,
  mealType: MealType,
  offset = 0,
): MenuOption[] {
  const chunks = splitIntoOptions(text);
  return chunks.map((lines, index) => {
    const n = offset + index + 1;
    const firstLine = lines.find((line) => line.trim().length > 0);
    const title = firstLine ? firstLine.slice(0, 60) : `Opcion ${n}`;

    return {
      optionId: `${weekIndex}-${dayOfWeek}-${mealType}-${n}`,
      title,
      lines,
    };
  });
}

function normalizeDailyMeals(meals: MealsByType, weekIndex: number, dayOfWeek: DayOfWeek): void {
  const optionCount = Math.max(
    meals.DESAYUNO.length,
    meals.ALMUERZO.length,
    meals.COMIDA.length,
    meals.MERIENDA.length,
    meals.CENA.length,
    1,
  );

  const mealTypes: MealType[] = ["DESAYUNO", "ALMUERZO", "COMIDA", "MERIENDA", "CENA", "POSTRE"];
  for (const mealType of mealTypes) {
    const current = meals[mealType];
    if (current.length === 0 || current.length >= optionCount) continue;

    const source = current[current.length - 1];
    for (let index = current.length; index < optionCount; index += 1) {
      const optionNumber = index + 1;
      current.push({
        optionId: `${weekIndex}-${dayOfWeek}-${mealType}-${optionNumber}`,
        title: source.title || `Opcion ${optionNumber}`,
        lines: [...source.lines],
      });
    }
  }
}

export function parsePlanNutricional(
  sheetMatrix: unknown[][],
  debug?: ParsePlanNutricionalDebug,
): NutritionPlan {
  const { headerRowIndex, dayMatches } = findHeaderRow(sheetMatrix);
  const weekColumns = detectWeekColumns(dayMatches);
  const mealBlocks = detectMealBlocks(sheetMatrix, headerRowIndex + 1);

  if (debug) {
    debug.headerRowIndex = headerRowIndex;
    debug.weekColumns = weekColumns;
    debug.week1Columns = weekColumns[0];
    debug.week2Columns = weekColumns[1];
    debug.mealBlocks = mealBlocks.map((block) => ({
      mealType: block.mealType,
      startRow: block.startRow,
      endRow: block.endRow,
    }));
  }

  const days: NutritionDay[] = [];

  for (let weekOffset = 0; weekOffset < weekColumns.length; weekOffset += 1) {
    const weekIndex = weekOffset + 1;
    const columns = weekColumns[weekOffset];

    for (const dayOfWeek of ORDERED_DAYS) {
      const meals = {
        DESAYUNO: [] as MenuOption[],
        ALMUERZO: [] as MenuOption[],
        COMIDA: [] as MenuOption[],
        MERIENDA: [] as MenuOption[],
        CENA: [] as MenuOption[],
        POSTRE: [] as MenuOption[],
      };

      let previousMainMeal: MainMealType | null = null;

      for (const block of mealBlocks) {
        let targetMealType: MealType = block.mealType;

        if (block.mealType === "POSTRE") {
          // El postre pertenece al bloque principal anterior (comida o cena).
          targetMealType = previousMainMeal ?? "POSTRE";
        } else if (isMainMealType(block.mealType)) {
          previousMainMeal = block.mealType;
        }

        const cellText = collectCellTextByBlock(sheetMatrix, block, columns[dayOfWeek]);
        if (!cellText.trim()) {
          continue;
        }

        if (block.mealType === "POSTRE" && isMainMealType(targetMealType)) {
          const dessertOptions = buildMenuOptions(
            cellText,
            weekIndex,
            dayOfWeek,
            targetMealType,
            0,
          );

          if (dessertOptions.length === 0) {
            continue;
          }

          if (meals[targetMealType].length === 0) {
            meals[targetMealType].push(...dessertOptions);
            continue;
          }

          dessertOptions.forEach((dessert, index) => {
            if (meals[targetMealType][index]) {
              meals[targetMealType][index].lines.push(...dessert.lines);
            } else {
              const optionNumber = meals[targetMealType].length + 1;
              meals[targetMealType].push({
                ...dessert,
                optionId: `${weekIndex}-${dayOfWeek}-${targetMealType}-${optionNumber}`,
                title: dessert.title || `Opcion ${optionNumber}`,
              });
            }
          });

          continue;
        }

        const options = buildMenuOptions(
          cellText,
          weekIndex,
          dayOfWeek,
          targetMealType,
          meals[targetMealType].length,
        );
        meals[targetMealType].push(...options);
      }

      days.push({
        weekIndex,
        dayOfWeek,
        meals: (() => {
          normalizeDailyMeals(meals, weekIndex, dayOfWeek);
          return meals;
        })(),
      });
    }
  }

  return {
    cycleWeeks: weekColumns.length,
    days,
  };
}
