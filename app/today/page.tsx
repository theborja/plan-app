"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import Card from "@/components/Card";
import NoPlanState from "@/components/NoPlanState";
import Skeleton from "@/components/Skeleton";
import { fetchJson, postJson } from "@/lib/clientApi";
import { formatDateShortSpanish, getLocalISODate } from "@/lib/date";

type MealType = "DESAYUNO" | "ALMUERZO" | "COMIDA" | "MERIENDA" | "CENA" | "POSTRE";

type DayPayload = {
  noPlan?: boolean;
  menuOptions?: Array<{
    optionId: string;
    optionLabel: string;
    meals: Array<{ mealType: MealType; lines: string[] }>;
  }>;
  day: {
    id: string;
    weekIndex: number;
    dayOfWeek: string;
    meals: Record<MealType, Array<{ id: string; title: string; lines: string[] }>>;
  } | null;
  selection: {
    selectedDayOptionId: string | null;
    done: boolean;
    note: string;
  } | null;
};

type WorkoutPayload = {
  trainingDay: {
    exercises: Array<{ id: string }>;
    label: string;
  } | null;
  session: {
    setLogsByExerciseId: Record<string, Array<{ weightKg: number | null }>>;
  } | null;
};

type DailyMenuOption = {
  optionId: string;
  optionLabel: string;
  meals: Array<{ mealType: MealType; lines: string[] }>;
};

const MEAL_TYPES: MealType[] = ["DESAYUNO", "ALMUERZO", "COMIDA", "MERIENDA", "CENA", "POSTRE"];

export default function TodayPage() {
  const isoDate = getLocalISODate();
  const [isLoading, setIsLoading] = useState(true);
  const [nutrition, setNutrition] = useState<DayPayload | null>(null);
  const [workout, setWorkout] = useState<WorkoutPayload | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [currentOptionIndex, setCurrentOptionIndex] = useState(0);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const [nutritionData, workoutData] = await Promise.all([
          fetchJson<DayPayload>(`/api/nutrition/day?date=${isoDate}`),
          fetchJson<WorkoutPayload>(`/api/workout/day?date=${isoDate}`),
        ]);
        setNutrition(nutritionData);
        setWorkout(workoutData);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [isoDate]);

  const dailyMenuOptions = useMemo(() => {
    if (nutrition?.menuOptions && nutrition.menuOptions.length > 0) {
      return nutrition.menuOptions;
    }

    if (!nutrition?.day) return [];
    const byIndex = new Map<number, DailyMenuOption>();

    for (const mealType of MEAL_TYPES) {
      const options = nutrition.day.meals[mealType] ?? [];
      options.forEach((option, idx) => {
        const current = byIndex.get(idx) ?? {
          optionId: option.id,
          optionLabel: `Opcion ${idx + 1}`,
          meals: [],
        };
        current.meals.push({ mealType, lines: option.lines });
        byIndex.set(idx, current);
      });
    }

    return Array.from(byIndex.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, value]) => value);
  }, [nutrition]);

  const selectedDailyMenuOptionId = nutrition?.selection?.selectedDayOptionId ?? null;
  const selectedDailyMenuOption = dailyMenuOptions.find((option) => option.optionId === selectedDailyMenuOptionId) ?? null;

  useEffect(() => {
    const idx = dailyMenuOptions.findIndex((item) => item.optionId === selectedDailyMenuOptionId);
    setCurrentOptionIndex(idx >= 0 ? idx : 0);
  }, [dailyMenuOptions, selectedDailyMenuOptionId]);

  async function saveSelection(patch: { selectedDayOptionId?: string; done?: boolean; note?: string }) {
    const current = nutrition?.selection;
    const payload = {
      dateISO: isoDate,
      selectedDayOptionId: patch.selectedDayOptionId ?? current?.selectedDayOptionId ?? null,
      done: patch.done ?? current?.done ?? false,
      note: patch.note ?? current?.note ?? "",
    };

    await postJson("/api/nutrition/selection", payload);
    setNutrition((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        selection: {
          selectedDayOptionId: payload.selectedDayOptionId,
          done: payload.done,
          note: payload.note,
        },
      };
    });
  }

  const doneCounts = workout?.session?.setLogsByExerciseId
    ? Object.values(workout.session.setLogsByExerciseId).filter(
        (sets) => sets.length > 0 && sets.every((set) => set.weightKg !== null),
      ).length
    : 0;
  const totalExercises = workout?.trainingDay?.exercises.length ?? 0;
  const hasPersistedWorkoutSession = !!workout?.session;
  const trainingDone = totalExercises > 0 && doneCounts >= totalExercises;
  const trainingStatusOk = !workout?.trainingDay || (hasPersistedWorkoutSession && trainingDone);
  const trainingLabel = workout?.trainingDay ? `Entrenamiento de ${workout.trainingDay.label}` : "Dia de descanso";

  if (isLoading) {
    return (
      <Card title="Cargando hoy">
        <Skeleton lines={4} />
      </Card>
    );
  }

  if (!nutrition?.day) {
    return <NoPlanState />;
  }

  const currentOption = dailyMenuOptions[Math.min(currentOptionIndex, Math.max(0, dailyMenuOptions.length - 1))];

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_oklab,var(--primary-end)_50%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_82%,var(--primary-end)_18%)] p-4 shadow-[0_10px_24px_rgba(108,93,211,0.16)] animate-card">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Resumen de hoy</h2>
        <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
          <p className="font-semibold text-[var(--foreground)]">{formatDateShortSpanish(isoDate)}</p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <button type="button" className="flex w-full items-center justify-between" onClick={() => setIsSheetOpen(true)}>
              <p className="font-semibold text-[var(--foreground)]">Menu</p>
              <span className={["rounded-full px-2 py-0.5 text-[10px] font-semibold", selectedDailyMenuOption ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"].join(" ")}>
                {selectedDailyMenuOption ? "OK" : "PEND"}
              </span>
            </button>
            <Link href="/workout" className="mt-2 flex items-center justify-between">
              <p className="font-semibold text-[var(--foreground)]">{trainingLabel}</p>
              <span className={["rounded-full px-2 py-0.5 text-[10px] font-semibold", trainingStatusOk ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600"].join(" ")}>
                {trainingStatusOk ? "OK" : "PEND"}
              </span>
            </Link>
          </div>
        </div>
      </section>

      <Card title="Menu completo del dia">
        {selectedDailyMenuOption ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Opcion {Math.min(currentOptionIndex, Math.max(0, dailyMenuOptions.length - 1)) + 1}
            </p>
            <ul className="mt-2 space-y-2 text-xs text-zinc-700">
              {selectedDailyMenuOption.meals.map((meal) => (
                <li key={meal.mealType}>
                  <p className="font-medium text-[var(--foreground)]">{meal.mealType}</p>
                  <p className="text-[var(--muted)]">{meal.lines.join(" | ")}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">Sin menu seleccionado.</p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white"
            onClick={() => setIsSheetOpen(true)}
          >
            Elegir menu
          </button>
          <button
            type="button"
            className={["rounded-xl px-3 py-2 text-sm font-semibold", nutrition.selection?.done ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-800"].join(" ")}
            onClick={() => void saveSelection({ done: !nutrition.selection?.done })}
          >
            {nutrition.selection?.done ? "Hecho" : "Marcar hecho"}
          </button>
        </div>

        <textarea
          className="mt-3 min-h-20 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Nota del menu diario"
          value={nutrition.selection?.note ?? ""}
          onChange={(event) => void saveSelection({ note: event.target.value })}
        />
      </Card>

      <BottomSheet open={isSheetOpen} title="Elegir menu diario" onClose={() => setIsSheetOpen(false)}>
        {dailyMenuOptions.length === 0 || !currentOption ? (
          <p className="text-sm text-[var(--muted)]">No hay opciones.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-soft)]" onClick={() => setCurrentOptionIndex((prev) => (prev === 0 ? dailyMenuOptions.length - 1 : prev - 1))}>{"<"}</button>
              <div className="text-center text-sm font-semibold">Opcion {currentOptionIndex + 1}</div>
              <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-soft)]" onClick={() => setCurrentOptionIndex((prev) => (prev + 1) % dailyMenuOptions.length)}>{">"}</button>
            </div>

            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="space-y-2 text-[12px] text-[var(--muted)]">
                {currentOption.meals.map((meal) => (
                  <div key={`${meal.mealType}-${currentOption.optionId}`}>
                    <p className="font-semibold text-[var(--foreground)]">{meal.mealType}</p>
                    <p>{meal.lines.join(" | ")}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-full bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  void saveSelection({ selectedDayOptionId: currentOption.optionId });
                  setIsSheetOpen(false);
                }}
              >
                Seleccionar menu
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
