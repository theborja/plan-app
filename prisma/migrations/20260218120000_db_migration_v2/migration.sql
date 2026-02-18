-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "public"."PlanSourceType" AS ENUM ('IMPORTED_EXCEL', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."MealType" AS ENUM ('DESAYUNO', 'ALMUERZO', 'COMIDA', 'POSTRE_COMIDA', 'MERIENDA', 'CENA', 'POSTRE_CENA');

-- CreateEnum
CREATE TYPE "public"."Weekday" AS ENUM ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Plan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceType" "public"."PlanSourceType" NOT NULL DEFAULT 'IMPORTED_EXCEL',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingDay" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Exercise" (
    "id" TEXT NOT NULL,
    "trainingDayId" TEXT NOT NULL,
    "exerciseIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER,
    "reps" TEXT,
    "restSeconds" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NutritionDayOption" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "weekIndex" INTEGER NOT NULL,
    "dayOfWeek" "public"."Weekday" NOT NULL,
    "dayOptionIndex" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionDayOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NutritionMeal" (
    "id" TEXT NOT NULL,
    "nutritionDayOptionId" TEXT NOT NULL,
    "mealType" "public"."MealType" NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "trainingDayId" TEXT NOT NULL,
    "dateISO" TEXT NOT NULL,
    "note" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExerciseSetLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "repsDone" INTEGER,
    "done" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseSetLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MealSelectionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dateISO" TEXT NOT NULL,
    "selectedDayOptionIndex" INTEGER,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealSelectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WeeklyMeasureLog" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyMeasureLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "public"."Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "public"."Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Plan_userId_isActive_idx" ON "public"."Plan"("userId", "isActive");

-- CreateIndex
CREATE INDEX "Plan_userId_importedAt_idx" ON "public"."Plan"("userId", "importedAt");

-- CreateIndex
CREATE INDEX "TrainingDay_planId_sortOrder_idx" ON "public"."TrainingDay"("planId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDay_planId_dayIndex_key" ON "public"."TrainingDay"("planId", "dayIndex");

-- CreateIndex
CREATE INDEX "Exercise_trainingDayId_idx" ON "public"."Exercise"("trainingDayId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_trainingDayId_exerciseIndex_key" ON "public"."Exercise"("trainingDayId", "exerciseIndex");

-- CreateIndex
CREATE INDEX "NutritionDayOption_planId_sortOrder_idx" ON "public"."NutritionDayOption"("planId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionDayOption_planId_dayOptionIndex_key" ON "public"."NutritionDayOption"("planId", "dayOptionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionDayOption_planId_weekIndex_dayOfWeek_key" ON "public"."NutritionDayOption"("planId", "weekIndex", "dayOfWeek");

-- CreateIndex
CREATE INDEX "NutritionMeal_nutritionDayOptionId_mealType_idx" ON "public"."NutritionMeal"("nutritionDayOptionId", "mealType");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_dateISO_idx" ON "public"."WorkoutSession"("userId", "dateISO");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_userId_planId_dateISO_key" ON "public"."WorkoutSession"("userId", "planId", "dateISO");

-- CreateIndex
CREATE INDEX "ExerciseSetLog_exerciseId_idx" ON "public"."ExerciseSetLog"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseSetLog_sessionId_exerciseId_setNumber_key" ON "public"."ExerciseSetLog"("sessionId", "exerciseId", "setNumber");

-- CreateIndex
CREATE INDEX "MealSelectionLog_userId_dateISO_idx" ON "public"."MealSelectionLog"("userId", "dateISO");

-- CreateIndex
CREATE UNIQUE INDEX "MealSelectionLog_userId_planId_dateISO_key" ON "public"."MealSelectionLog"("userId", "planId", "dateISO");

-- CreateIndex
CREATE INDEX "WeeklyMeasureLog_userId_weekStartISO_idx" ON "public"."WeeklyMeasureLog"("userId", "weekStartISO");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMeasureLog_userId_weekStartISO_key" ON "public"."WeeklyMeasureLog"("userId", "weekStartISO");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Plan" ADD CONSTRAINT "Plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingDay" ADD CONSTRAINT "TrainingDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Exercise" ADD CONSTRAINT "Exercise_trainingDayId_fkey" FOREIGN KEY ("trainingDayId") REFERENCES "public"."TrainingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NutritionDayOption" ADD CONSTRAINT "NutritionDayOption_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."NutritionMeal" ADD CONSTRAINT "NutritionMeal_nutritionDayOptionId_fkey" FOREIGN KEY ("nutritionDayOptionId") REFERENCES "public"."NutritionDayOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutSession" ADD CONSTRAINT "WorkoutSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutSession" ADD CONSTRAINT "WorkoutSession_trainingDayId_fkey" FOREIGN KEY ("trainingDayId") REFERENCES "public"."TrainingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExerciseSetLog" ADD CONSTRAINT "ExerciseSetLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExerciseSetLog" ADD CONSTRAINT "ExerciseSetLog_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "public"."Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MealSelectionLog" ADD CONSTRAINT "MealSelectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MealSelectionLog" ADD CONSTRAINT "MealSelectionLog_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WeeklyMeasureLog" ADD CONSTRAINT "WeeklyMeasureLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enforce single active plan per user
CREATE UNIQUE INDEX IF NOT EXISTS plans_user_active_unique ON "Plan" ("userId") WHERE "isActive" = true;

