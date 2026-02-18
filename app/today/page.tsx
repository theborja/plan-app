"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import {
  getActivePlanHybrid,
  hydrateTodaySelectionHybrid,
  saveTodaySelectionHybrid,
} from "@/lib/adapters/hybrid";
import { formatDateShortSpanish, getCycleDayIndex, getLocalISODate } from "@/lib/date";
import { resolveTrainingDay } from "@/lib/planResolver";
import {
  defaultSelectionsV1,
  loadSelectionsV1,
  loadSettingsV1,
  saveSelectionsV1,
} from "@/lib/storage";
import type { DayOfWeek, MealType, PlanV1, SelectionsV1, SettingsV1 } from "@/lib/types";

const MEAL_TYPES: MealType[] = [
  "DESAYUNO",
  "ALMUERZO",
  "COMIDA",
  "MERIENDA",
  "CENA",
  "POSTRE",
];

const DAY_ORDER: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DailyMenuOption = {
  optionId: string;
  optionLabel: string;
  weekIndex: number;
  meals: Array<{ mealType: MealType; lines: string[] }>;
};

export default function TodayPage() {
  const [plan, setPlan] = useState<PlanV1 | null>(null);
  const [settings, setSettings] = useState<SettingsV1 | null>(null);
  const [selections, setSelections] = useState<SelectionsV1>(defaultSelectionsV1());
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOptionIndex, setCurrentOptionIndex] = useState(0);

  const isoDate = getLocalISODate();

  useEffect(() => {
    setSettings(loadSettingsV1());
    setSelections(loadSelectionsV1());
    setIsLoading(false);
    void (async () => {
      const [nextPlan, nextSelections] = await Promise.all([
        getActivePlanHybrid(),
        hydrateTodaySelectionHybrid(isoDate),
      ]);
      setPlan(nextPlan);
      setSelections(nextSelections);
    })();
  }, [isoDate]);

  const dailyMenuOptions = useMemo(() => {
    if (!plan || !settings) return null;

    const days = [...plan.nutrition.days].sort((a, b) => {
      if (a.weekIndex === b.weekIndex) {
        return DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
      }
      return a.weekIndex - b.weekIndex;
    });

    return days.map((day, index) => {
      const meals = MEAL_TYPES.map((mealType) => {
        const allLines = (day.meals[mealType] ?? [])
          .flatMap((option) => option.lines)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        return { mealType, lines: allLines };
      }).filter((meal) => meal.lines.length > 0);

      return {
        optionId: String(index + 1),
        optionLabel: `Opcion ${index + 1}`,
        weekIndex: day.weekIndex,
        meals,
      } satisfies DailyMenuOption;
    });
  }, [plan, settings]);

  const daySelection = selections.byDate[isoDate];
  const selectedDailyMenuOptionId = daySelection?.dailyMenu?.selectedDayOptionId;
  const selectedDailyMenuOption =
    dailyMenuOptions?.find((option) => option.optionId === selectedDailyMenuOptionId) ?? null;

  useEffect(() => {
    if (!dailyMenuOptions || !settings) return;
    const idx = getCycleDayIndex(isoDate, settings.nutritionStartDateISO, dailyMenuOptions.length);
    setCurrentOptionIndex(idx);
  }, [dailyMenuOptions, isoDate, settings]);

  function updateDailyMenuSelection(patch: {
    selectedDayOptionId?: string;
    done?: boolean;
    note?: string;
  }) {
    setSelections((prev) => {
      const next: SelectionsV1 = {
        ...prev,
        byDate: { ...prev.byDate },
      };

      const currentDay = next.byDate[isoDate] ?? { meals: {} };
      next.byDate[isoDate] = {
        ...currentDay,
        meals: { ...currentDay.meals },
        dailyMenu: {
          ...currentDay.dailyMenu,
          ...patch,
          updatedAtISO: new Date().toISOString(),
        },
      };

      saveSelectionsV1(next);
      return next;
    });

    void saveTodaySelectionHybrid({
      dateISO: isoDate,
      selectedDayOptionId: patch.selectedDayOptionId,
      done: patch.done,
      note: patch.note,
    });
  }

  const menuSelected = !!selectedDailyMenuOption;
  const trainingDay = plan && settings ? resolveTrainingDay(plan, isoDate, settings) : null;
  const doneExerciseIndexes = daySelection?.workout?.doneExerciseIndexes ?? [];
  const trainingDone =
    !!trainingDay &&
    trainingDay.exercises.length > 0 &&
    doneExerciseIndexes.length >= trainingDay.exercises.length;
  const trainingStatusOk = !trainingDay || trainingDone;

  const cleanedTrainingLabel = trainingDay
    ? trainingDay.label.replace(/^DIA\s*\d+\s*[-:]\s*/i, "").trim()
    : "";
  const trainingLabel = trainingDay
    ? `Entrenamiento de ${cleanedTrainingLabel || trainingDay.label}`
    : "Dia de descanso";

  if (!plan) {
    return (
      <div className="space-y-4">
        {isLoading ? (
          <Card title="Cargando plan">
            <Skeleton lines={4} />
          </Card>
        ) : (
          <EmptyState
            title="No hay plan cargado"
            description="Importa un archivo para empezar a seleccionar menus."
            action={
              <Link
                href="/import"
                className="inline-flex rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-4 py-2 text-sm font-semibold text-white"
              >
                Ir a importar
              </Link>
            }
          />
        )}
      </div>
    );
  }

  if (!dailyMenuOptions || dailyMenuOptions.length === 0) {
    return (
      <div className="space-y-4">
        <Card title="Hoy">
          <p className="text-sm text-zinc-600">
            No hay opciones de menu disponibles para {formatDateShortSpanish(isoDate)}.
          </p>
        </Card>
      </div>
    );
  }

  const currentOption = dailyMenuOptions[currentOptionIndex];

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_oklab,var(--primary-end)_50%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_82%,var(--primary-end)_18%)] p-4 shadow-[0_10px_24px_rgba(108,93,211,0.16)] animate-card">
        <h2 className="text-base font-semibold text-[var(--foreground)]">Resumen de hoy</h2>
        <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
          <p className="font-semibold text-[var(--foreground)]">{formatDateShortSpanish(isoDate)}</p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] px-3 py-2">
            <button
              type="button"
              className="flex w-full items-center justify-between"
              onClick={() => {
                const idx = dailyMenuOptions.findIndex(
                  (option) => option.optionId === selectedDailyMenuOptionId,
                );
                setCurrentOptionIndex(idx === -1 ? 0 : idx);
                setIsSheetOpen(true);
              }}
            >
              <p className="font-semibold text-[var(--foreground)]">Menu</p>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  menuSelected ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600",
                ].join(" ")}
              >
                {menuSelected ? "OK" : "PEND"}
              </span>
            </button>
            <Link href="/workout" className="mt-2 flex items-center justify-between">
              <p className="font-semibold text-[var(--foreground)]">{trainingLabel}</p>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  trainingStatusOk ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-600",
                ].join(" ")}
              >
                {trainingStatusOk ? "OK" : "PEND"}
              </span>
            </Link>
          </div>
        </div>
      </section>

      <Card title="Menu completo del dia">
        <div className="space-y-3">
          {selectedDailyMenuOption ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {selectedDailyMenuOption.optionLabel}
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

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white shadow-sm"
              onClick={() => {
                const idx = dailyMenuOptions.findIndex(
                  (option) => option.optionId === selectedDailyMenuOptionId,
                );
                setCurrentOptionIndex(idx === -1 ? 0 : idx);
                setIsSheetOpen(true);
              }}
            >
              Elegir menu
            </button>
            <button
              type="button"
              className={[
                "rounded-xl px-3 py-2 text-sm font-semibold",
                daySelection?.dailyMenu?.done ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-800",
              ].join(" ")}
              onClick={() =>
                updateDailyMenuSelection({
                  done: !daySelection?.dailyMenu?.done,
                })
              }
            >
              {daySelection?.dailyMenu?.done ? "Hecho" : "Marcar hecho"}
            </button>
          </div>

          <textarea
            className="min-h-20 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Nota del menu diario"
            value={daySelection?.dailyMenu?.note ?? ""}
            onChange={(event) => updateDailyMenuSelection({ note: event.target.value })}
          />
        </div>
      </Card>

      <BottomSheet open={isSheetOpen} title="Elegir menu diario" onClose={() => setIsSheetOpen(false)}>
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-soft)] text-base font-semibold text-[var(--muted)]"
              onClick={() =>
                setCurrentOptionIndex((prev) =>
                  prev === 0 ? dailyMenuOptions.length - 1 : prev - 1,
                )
              }
              aria-label="Opcion anterior"
            >
              {"<"}
            </button>
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <span className="rounded-full bg-gradient-to-r from-[var(--primary-start)]/20 to-[var(--primary-end)]/20 px-4 py-1 text-base font-bold tracking-tight text-[var(--foreground)]">
                {currentOption.optionLabel}
              </span>
              <span className="mt-1 text-[11px] font-medium text-[var(--muted)]">
                {currentOptionIndex + 1} de {dailyMenuOptions.length}
              </span>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-soft)] text-base font-semibold text-[var(--muted)]"
              onClick={() => setCurrentOptionIndex((prev) => (prev + 1) % dailyMenuOptions.length)}
              aria-label="Siguiente opcion"
            >
              {">"}
            </button>
          </div>

          <div className="mx-auto w-full rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-[var(--shadow-soft)]">
            <div className="mt-3 space-y-2 text-[12px] text-[var(--muted)]">
              {currentOption.meals.map((meal) => (
                <div key={`${meal.mealType}-${currentOption.optionId}`}>
                  <p className="font-semibold text-[var(--foreground)] text-[12px]">{meal.mealType}</p>
                  <p>{meal.lines.join(" | ")}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="mt-4 w-full rounded-full bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
                updateDailyMenuSelection({ selectedDayOptionId: currentOption.optionId });
                setIsSheetOpen(false);
              }}
            >
              Seleccionar menu
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
