import * as XLSX from "xlsx";
import { parsePlanEntrenamiento } from "@/lib/parsers/parsePlanEntrenamiento";
import {
  parsePlanNutricional,
  type ParsePlanNutricionalDebug,
} from "@/lib/parsers/parsePlanNutricional";
import type { PlanV1 } from "@/lib/types";

export type ParseWorkbookDebug = {
  nutrition?: ParsePlanNutricionalDebug;
};

function toSheetMatrix(sheet: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];
}

function getRequiredSheet(workbook: XLSX.WorkBook, sheetName: string): XLSX.WorkSheet {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`No se encontro la hoja requerida: "${sheetName}".`);
  }
  return sheet;
}

function getOptionalSheet(workbook: XLSX.WorkBook, sheetName: string): XLSX.WorkSheet | null {
  return workbook.Sheets[sheetName] ?? null;
}

export function parseWorkbookToPlanV1(
  workbook: XLSX.WorkBook,
  sourceFileName: string,
  debug?: ParseWorkbookDebug,
): PlanV1 {
  const trainingSheet = getRequiredSheet(workbook, "PLAN ENTRENAMIENTO");
  const nutritionSheet = getOptionalSheet(workbook, "PLAN NUTRICIONAL");

  const trainingMatrix = toSheetMatrix(trainingSheet);
  const nutritionDebug: ParsePlanNutricionalDebug = {};
  const nutrition = nutritionSheet
    ? parsePlanNutricional(toSheetMatrix(nutritionSheet), nutritionDebug)
    : {
        cycleWeeks: 1,
        days: [],
      };
  const training = parsePlanEntrenamiento(trainingMatrix);

  if (debug) {
    debug.nutrition = nutritionSheet ? nutritionDebug : undefined;
  }

  return {
    version: 1,
    sourceFileName,
    importedAtISO: new Date().toISOString(),
    nutrition,
    training,
  };
}

export function parseArrayBufferToPlanV1(
  data: ArrayBuffer,
  sourceFileName: string,
  debug?: ParseWorkbookDebug,
): PlanV1 {
  const workbook = XLSX.read(data, { type: "array" });
  return parseWorkbookToPlanV1(workbook, sourceFileName, debug);
}
