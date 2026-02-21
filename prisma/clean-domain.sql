-- Limpieza de dominio (mantiene auth: User + Session)
DROP TABLE IF EXISTS "WeeklyMeasure" CASCADE;
DROP TABLE IF EXISTS "MealSelectionLog" CASCADE;
DROP TABLE IF EXISTS "ExerciseSetLog" CASCADE;
DROP TABLE IF EXISTS "WorkoutSession" CASCADE;
DROP TABLE IF EXISTS "UserSettings" CASCADE;
DROP TABLE IF EXISTS "NutritionMealLine" CASCADE;
DROP TABLE IF EXISTS "NutritionMealOption" CASCADE;
DROP TABLE IF EXISTS "NutritionDay" CASCADE;
DROP TABLE IF EXISTS "Exercise" CASCADE;
DROP TABLE IF EXISTS "TrainingDay" CASCADE;
DROP TABLE IF EXISTS "UserPlan" CASCADE;

-- Si quedaron enums de dominio de pruebas anteriores
DO $$ BEGIN DROP TYPE IF EXISTS "MealType" CASCADE; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS "DayOfWeek" CASCADE; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN DROP TYPE IF EXISTS "PlanSourceType" CASCADE; EXCEPTION WHEN undefined_object THEN NULL; END $$;