export type PlanVersion = 1;
export type SelectionsVersion = 1;
export type SettingsVersion = 1;
export type MeasuresVersion = 1;

export type TrainingDayNumber = number;
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
  weekIndex: number;
  dayOfWeek: DayOfWeek;
  meals: Record<MealType, MenuOption[]>;
};

export type NutritionPlan = {
  cycleWeeks: number;
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
  trainingDays: DayOfWeek[];
};

export type WeeklyMeasureEntry = {
  weightKg?: number;
  neckCm?: number;
  armCm?: number;
  waistCm?: number;
  abdomenCm?: number;
  hipCm?: number;
  thighCm?: number;
  note?: string;
  updatedAtISO?: string;
};

export type MeasuresV1 = {
  version: MeasuresVersion;
  byWeek: Record<string, WeeklyMeasureEntry>;
  avatarId?: string;
};
