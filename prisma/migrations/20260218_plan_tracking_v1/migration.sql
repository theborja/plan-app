-- Enums
DO $$ BEGIN
  CREATE TYPE "PlanSourceType" AS ENUM ('IMPORTED_EXCEL', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DayOfWeek" AS ENUM ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "MealType" AS ENUM ('DESAYUNO', 'ALMUERZO', 'COMIDA', 'MERIENDA', 'CENA', 'POSTRE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tablas dominio
CREATE TABLE IF NOT EXISTS "UserPlan" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sourceFileName" TEXT NOT NULL,
  "sourceType" "PlanSourceType" NOT NULL,
  "importedByUserId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserPlan_importedByUserId_fkey" FOREIGN KEY ("importedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TrainingDay" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "dayIndex" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "TrainingDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "UserPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Exercise" (
  "id" TEXT PRIMARY KEY,
  "trainingDayId" TEXT NOT NULL,
  "exerciseIndex" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "sets" INTEGER,
  "reps" TEXT,
  "restSeconds" INTEGER,
  "notes" TEXT,
  CONSTRAINT "Exercise_trainingDayId_fkey" FOREIGN KEY ("trainingDayId") REFERENCES "TrainingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "NutritionDay" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "weekIndex" INTEGER NOT NULL,
  "dayOfWeek" "DayOfWeek" NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "NutritionDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "UserPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "NutritionMealOption" (
  "id" TEXT PRIMARY KEY,
  "nutritionDayId" TEXT NOT NULL,
  "mealType" "MealType" NOT NULL,
  "optionIndex" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  CONSTRAINT "NutritionMealOption_nutritionDayId_fkey" FOREIGN KEY ("nutritionDayId") REFERENCES "NutritionDay"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "NutritionMealLine" (
  "id" TEXT PRIMARY KEY,
  "mealOptionId" TEXT NOT NULL,
  "lineIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  CONSTRAINT "NutritionMealLine_mealOptionId_fkey" FOREIGN KEY ("mealOptionId") REFERENCES "NutritionMealOption"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "UserSettings" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "nutritionStartDateISO" TEXT NOT NULL,
  "trainingDays" "DayOfWeek"[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WorkoutSession" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "trainingDayId" TEXT NOT NULL,
  "dateISO" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkoutSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "UserPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkoutSession_trainingDayId_fkey" FOREIGN KEY ("trainingDayId") REFERENCES "TrainingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ExerciseSetLog" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "setNumber" INTEGER NOT NULL,
  "weightKg" DOUBLE PRECISION,
  "repsDone" INTEGER,
  "done" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExerciseSetLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExerciseSetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MealSelectionLog" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "dateISO" TEXT NOT NULL,
  "selectedDayOptionId" TEXT,
  "done" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealSelectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MealSelectionLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "UserPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WeeklyMeasure" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "weekStartISO" TEXT NOT NULL,
  "weightKg" DOUBLE PRECISION,
  "neckCm" DOUBLE PRECISION,
  "armCm" DOUBLE PRECISION,
  "waistCm" DOUBLE PRECISION,
  "abdomenCm" DOUBLE PRECISION,
  "hipCm" DOUBLE PRECISION,
  "thighCm" DOUBLE PRECISION,
  "note" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyMeasure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Uniques e indices
CREATE UNIQUE INDEX IF NOT EXISTS "TrainingDay_planId_dayIndex_key" ON "TrainingDay"("planId", "dayIndex");
CREATE UNIQUE INDEX IF NOT EXISTS "Exercise_trainingDayId_exerciseIndex_key" ON "Exercise"("trainingDayId", "exerciseIndex");
CREATE UNIQUE INDEX IF NOT EXISTS "NutritionDay_planId_weekIndex_dayOfWeek_key" ON "NutritionDay"("planId", "weekIndex", "dayOfWeek");
CREATE UNIQUE INDEX IF NOT EXISTS "NutritionMealOption_nutritionDayId_mealType_optionIndex_key" ON "NutritionMealOption"("nutritionDayId", "mealType", "optionIndex");
CREATE UNIQUE INDEX IF NOT EXISTS "NutritionMealLine_mealOptionId_lineIndex_key" ON "NutritionMealLine"("mealOptionId", "lineIndex");
CREATE UNIQUE INDEX IF NOT EXISTS "UserSettings_userId_key" ON "UserSettings"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkoutSession_userId_dateISO_key" ON "WorkoutSession"("userId", "dateISO");
CREATE UNIQUE INDEX IF NOT EXISTS "ExerciseSetLog_sessionId_exerciseId_setNumber_key" ON "ExerciseSetLog"("sessionId", "exerciseId", "setNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "MealSelectionLog_userId_dateISO_key" ON "MealSelectionLog"("userId", "dateISO");
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyMeasure_userId_weekStartISO_key" ON "WeeklyMeasure"("userId", "weekStartISO");

CREATE INDEX IF NOT EXISTS "UserPlan_userId_isActive_idx" ON "UserPlan"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "UserPlan_userId_importedAt_idx" ON "UserPlan"("userId", "importedAt" DESC);
CREATE INDEX IF NOT EXISTS "TrainingDay_planId_sortOrder_idx" ON "TrainingDay"("planId", "sortOrder");
CREATE INDEX IF NOT EXISTS "NutritionDay_planId_sortOrder_idx" ON "NutritionDay"("planId", "sortOrder");
CREATE INDEX IF NOT EXISTS "NutritionMealOption_nutritionDayId_mealType_idx" ON "NutritionMealOption"("nutritionDayId", "mealType");
CREATE INDEX IF NOT EXISTS "WorkoutSession_userId_dateISO_idx" ON "WorkoutSession"("userId", "dateISO");
CREATE INDEX IF NOT EXISTS "ExerciseSetLog_exerciseId_idx" ON "ExerciseSetLog"("exerciseId");
CREATE INDEX IF NOT EXISTS "MealSelectionLog_userId_dateISO_idx" ON "MealSelectionLog"("userId", "dateISO");
CREATE INDEX IF NOT EXISTS "WeeklyMeasure_userId_weekStartISO_idx" ON "WeeklyMeasure"("userId", "weekStartISO");