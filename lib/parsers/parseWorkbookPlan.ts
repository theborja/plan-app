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

export function parseWorkbookToPlanV1(
  workbook: XLSX.WorkBook,
  sourceFileName: string,
  debug?: ParseWorkbookDebug,
): PlanV1 {
  const nutritionSheet = getRequiredSheet(workbook, "PLAN NUTRICIONAL");
  const trainingSheet = getRequiredSheet(workbook, "PLAN ENTRENAMIENTO");

  const nutritionMatrix = toSheetMatrix(nutritionSheet);
  const trainingMatrix = toSheetMatrix(trainingSheet);

  const nutritionDebug: ParsePlanNutricionalDebug = {};
  const nutrition = parsePlanNutricional(nutritionMatrix, nutritionDebug);
  const training = parsePlanEntrenamiento(trainingMatrix);

  if (debug) {
    debug.nutrition = nutritionDebug;
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
