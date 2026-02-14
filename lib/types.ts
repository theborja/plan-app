export type PlanVersion = 1;
export type SelectionsVersion = 1;
export type SettingsVersion = 1;

export type TrainingDayNumber = 1 | 2 | 3 | 4;
export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type MealType =
  | "DESAYUNO"
  | "ALMUERZO"
  | "COMIDA"
  | "MERIENDA"
  | "CENA"
  | "POSTRE";

export type TrainingDayMap = {
  Tue: TrainingDayNumber;
  Wed: TrainingDayNumber;
  Sat: TrainingDayNumber;
  Sun: TrainingDayNumber;
};

export type MenuOption = {
  optionId: string;
  title: string;
  lines: string[];
};

export type NutritionDay = {
  weekIndex: 1 | 2;
  dayOfWeek: DayOfWeek;
  meals: Record<MealType, MenuOption[]>;
};

export type NutritionPlan = {
  cycleWeeks: 2;
  days: NutritionDay[];
};

export type Exercise = {
  id: string;
  name: string;
  series?: number | null;
  reps?: string | null;
  restSeconds?: number | null;
  notes?: string | null;
};

export type TrainingDay = {
  dayIndex: TrainingDayNumber;
  day?: TrainingDayNumber;
  label: string;
  exercises: Exercise[];
};

export type TrainingPlan = {
  days: TrainingDay[];
};

export type PlanV1 = {
  version: PlanVersion;
  sourceFileName: string;
  importedAtISO: string;
  nutrition: NutritionPlan;
  training: TrainingPlan;
};

export type MealSelection = {
  selectedOptionId?: string;
  done?: boolean;
  note?: string;
  updatedAtISO?: string;
};

export type DailySelections = {
  meals: Partial<Record<MealType, MealSelection>>;
  dailyMenu?: {
    selectedDayOptionId?: string;
    done?: boolean;
    note?: string;
    updatedAtISO?: string;
  };
  workout?: {
    doneExerciseIndexes: number[];
    lastWeightByExerciseIndex?: Record<string, string>;
    note?: string;
    updatedAtISO?: string;
  };
};

export type SelectionsV1 = {
  version: SelectionsVersion;
  byDate: Record<string, DailySelections>;
};

export type SettingsV1 = {
  version: SettingsVersion;
  nutritionStartDateISO: string;
  trainingDayMap: TrainingDayMap;
};
