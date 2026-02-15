"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { formatDayLabel, getLocalISODate, getNutritionWeekIndex } from "@/lib/date";
import {
  defaultSelectionsV1,
  loadPlanV1,
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
  sourceDayOfWeek: DayOfWeek;
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
    setPlan(loadPlanV1());
    setSettings(loadSettingsV1());
    setSelections(loadSelectionsV1());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (plan) return;
    const timer = window.setTimeout(() => {
      setPlan(loadPlanV1());
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [plan]);

  const weekIndex = settings
    ? getNutritionWeekIndex(isoDate, settings.nutritionStartDateISO, 2)
    : 1;

  const dailyMenuOptions = useMemo(() => {
    if (!plan || !settings) return null;
    const weekDays = plan.nutrition.days
      .sort((a, b) => {
        if (a.weekIndex === b.weekIndex) {
          return DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
        }
        return a.weekIndex - b.weekIndex;
      });

    return weekDays.map((day, index) => {
      const meals = MEAL_TYPES.map((mealType) => {
        const allLines = (day.meals[mealType] ?? [])
          .flatMap((option) => option.lines)
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        return {
          mealType,
          lines: allLines,
        };
      }).filter((meal) => meal.lines.length > 0);

        return {
          optionId: `${weekIndex}-${day.dayOfWeek}`,
          weekIndex: day.weekIndex,
          optionLabel: `Opcion ${index + 1}`,
          sourceDayOfWeek: day.dayOfWeek,
          meals,
        };
      });
  }, [plan, settings, isoDate]);

  const daySelection = selections.byDate[isoDate];
  const selectedDailyMenuOptionId = daySelection?.dailyMenu?.selectedDayOptionId;
  const selectedDailyMenuOption = dailyMenuOptions?.find(
    (option) => option.optionId === selectedDailyMenuOptionId,
  );

  useEffect(() => {
    if (!dailyMenuOptions) return;
    const targetWeek = weekIndex;
    const idx = dailyMenuOptions.findIndex((option) => option.weekIndex === targetWeek);
    setCurrentOptionIndex(idx === -1 ? 0 : idx);
  }, [dailyMenuOptions, weekIndex]);

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
        meals: {
          ...currentDay.meals,
        },
        dailyMenu: {
          ...currentDay.dailyMenu,
          ...patch,
          updatedAtISO: new Date().toISOString(),
        },
      };

      saveSelectionsV1(next);
      return next;
    });
  }

  const totalMenus = dailyMenuOptions?.length ?? 0;
  const selectedCount = selectedDailyMenuOption ? 1 : 0;
  const doneCount = daySelection?.dailyMenu?.done ? 1 : 0;

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
            No hay opciones de menu disponibles para {formatDayLabel(isoDate)}.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Resumen de hoy">
        <div className="space-y-2 text-sm text-[var(--muted)]">
          <p className="font-semibold text-[var(--foreground)]">{formatDayLabel(isoDate)}</p>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-xs">
              Semana {weekIndex}/2
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-xs">
              Menus: {selectedCount}/1
            </span>
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-2 py-1 text-xs">
              Hecho: {doneCount}/1
            </span>
          </div>
          <p className="text-xs text-[var(--muted)]">Opciones disponibles esta semana: {totalMenus}</p>
        </div>
      </Card>

      <Card title="Menu completo del dia">
        <div className="space-y-3">
          {selectedDailyMenuOption ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-soft)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {selectedDailyMenuOption.optionLabel}
                  </p>
                  <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                    Semana {selectedDailyMenuOption.weekIndex}
                  </span>
                </div>
              <p className="text-xs text-[var(--muted)]">
                Basado en columna {selectedDailyMenuOption.sourceDayOfWeek}
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
              const idx = dailyMenuOptions?.findIndex(
                (option) => option.optionId === selectedDailyMenuOptionId,
              );
              setCurrentOptionIndex(idx === -1 || idx === undefined ? 0 : idx);
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
        {dailyMenuOptions && dailyMenuOptions[currentOptionIndex] && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                className="rounded-full bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--muted)]"
                onClick={() =>
                  setCurrentOptionIndex((prev) =>
                    prev === 0 ? dailyMenuOptions.length - 1 : prev - 1,
                  )
                }
              >
                ← Anterior
              </button>
              <span className="text-xs font-semibold text-[var(--muted)]">
                {dailyMenuOptions[currentOptionIndex].optionLabel}
              </span>
              <button
                type="button"
                className="rounded-full bg-[var(--surface-soft)] px-3 py-2 text-xs font-semibold text-[var(--muted)]"
                onClick={() =>
                  setCurrentOptionIndex((prev) => (prev + 1) % dailyMenuOptions.length)
                }
              >
                Siguiente →
              </button>
            </div>
            <div className="mx-auto w-full rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {dailyMenuOptions[currentOptionIndex].optionLabel}
              </p>
              <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                  Semana {dailyMenuOptions[currentOptionIndex].weekIndex}
              </span>
            </div>
              <div className="mt-3 space-y-2 text-[12px] text-[var(--muted)]">
                {dailyMenuOptions[currentOptionIndex].meals.map((meal) => (
                  <div key={`${meal.mealType}-${dailyMenuOptions[currentOptionIndex].optionId}`}>
                    <p className="font-semibold text-[var(--foreground)] text-[12px]">{meal.mealType}</p>
                    <p>{meal.lines.join(" | ")}</p>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-full bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  updateDailyMenuSelection({
                    selectedDayOptionId: dailyMenuOptions[currentOptionIndex].optionId,
                  });
                  setIsSheetOpen(false);
                }}
              >
                Seleccionar menú
              </button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
