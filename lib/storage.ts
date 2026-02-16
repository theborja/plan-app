import type { DayOfWeek, PlanV1, SelectionsV1, SettingsV1, TrainingDayMap } from "@/lib/types";
import { isPlanV1, isSelectionsV1, isSettingsV1 } from "@/lib/validate";

export const STORAGE_KEYS = {
  plan: "plan_v1",
  selections: "selections_v1",
  settings: "settings_v1",
} as const;

const DEFAULT_TRAINING_DAY_MAP: TrainingDayMap = {
  Tue: 1,
  Wed: 2,
  Sat: 3,
  Sun: 4,
};
const DEFAULT_TRAINING_DAYS: DayOfWeek[] = ["Tue", "Wed", "Sat", "Sun"];
const DAY_ORDER: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getTodayISO(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeRead(key: string): unknown {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function safeWrite(key: string, value: unknown): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function defaultSettingsV1(date = new Date()): SettingsV1 {
  return {
    version: 1,
    nutritionStartDateISO: getTodayISO(date),
    trainingDays: [...DEFAULT_TRAINING_DAYS],
  };
}

export function defaultSelectionsV1(): SelectionsV1 {
  return {
    version: 1,
    byDate: {},
  };
}

export function loadPlanV1(): PlanV1 | null {
  const parsed = safeRead(STORAGE_KEYS.plan);
  return isPlanV1(parsed) ? parsed : null;
}

export function savePlanV1(plan: PlanV1): void {
  if (!isPlanV1(plan)) {
    throw new Error("Invalid PlanV1 payload.");
  }
  safeWrite(STORAGE_KEYS.plan, plan);
}

export function loadSelectionsV1(): SelectionsV1 {
  const parsed = safeRead(STORAGE_KEYS.selections);
  if (isSelectionsV1(parsed)) return parsed;

  // Migracion minima desde un formato previo: byDateISO -> byDate.
  if (
    parsed &&
    typeof parsed === "object" &&
    "version" in parsed &&
    (parsed as { version?: unknown }).version === 1 &&
    "byDateISO" in (parsed as Record<string, unknown>)
  ) {
    const oldByDate = (parsed as { byDateISO?: unknown }).byDateISO;
    if (oldByDate && typeof oldByDate === "object" && !Array.isArray(oldByDate)) {
      const migrated: SelectionsV1 = {
        version: 1,
        byDate: oldByDate as SelectionsV1["byDate"],
      };
      if (isSelectionsV1(migrated)) {
        saveSelectionsV1(migrated);
        return migrated;
      }
    }
  }

  const fallback = defaultSelectionsV1();
  saveSelectionsV1(fallback);
  return fallback;
}

export function saveSelectionsV1(selections: SelectionsV1): void {
  if (!isSelectionsV1(selections)) {
    throw new Error("Invalid SelectionsV1 payload.");
  }
  safeWrite(STORAGE_KEYS.selections, selections);
}

export function loadSettingsV1(): SettingsV1 {
  const parsed = safeRead(STORAGE_KEYS.settings);
  if (isSettingsV1(parsed)) return parsed;

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const legacy = parsed as {
      version?: unknown;
      nutritionStartDateISO?: unknown;
      trainingDayMap?: Partial<TrainingDayMap>;
    };

    if (
      legacy.version === 1 &&
      typeof legacy.nutritionStartDateISO === "string" &&
      legacy.trainingDayMap &&
      typeof legacy.trainingDayMap === "object"
    ) {
      const ordered = Object.entries(DEFAULT_TRAINING_DAY_MAP)
        .map(([day, fallbackOrder]) => {
          const key = day as keyof TrainingDayMap;
          const orderRaw = legacy.trainingDayMap?.[key];
          const order =
            typeof orderRaw === "number" && Number.isFinite(orderRaw) && orderRaw > 0
              ? orderRaw
              : fallbackOrder;
          return { day: day as DayOfWeek, order };
        })
        .sort((a, b) => a.order - b.order)
        .map((item) => item.day)
        .filter((day) => DAY_ORDER.includes(day));

      const migrated: SettingsV1 = {
        version: 1,
        nutritionStartDateISO: legacy.nutritionStartDateISO,
        trainingDays: ordered.length > 0 ? ordered : [...DEFAULT_TRAINING_DAYS],
      };

      if (isSettingsV1(migrated)) {
        saveSettingsV1(migrated);
        return migrated;
      }
    }
  }

  const fallback = defaultSettingsV1();
  saveSettingsV1(fallback);
  return fallback;
}

export function saveSettingsV1(settings: SettingsV1): void {
  if (!isSettingsV1(settings)) {
    throw new Error("Invalid SettingsV1 payload.");
  }
  safeWrite(STORAGE_KEYS.settings, settings);
}
