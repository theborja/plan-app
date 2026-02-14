"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
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
  const [hoveredOptionId, setHoveredOptionId] = useState<string | null>(null);

  const isoDate = getLocalISODate();

  useEffect(() => {
    setPlan(loadPlanV1());
    setSettings(loadSettingsV1());
    setSelections(loadSelectionsV1());
  }, []);

  useEffect(() => {
    if (plan) return;
    const timer = window.setTimeout(() => {
      setPlan(loadPlanV1());
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [plan]);

  const dailyMenuOptions = useMemo(() => {
    if (!plan || !settings) return null;
    const weekIndex = getNutritionWeekIndex(isoDate, settings.nutritionStartDateISO, 2);
    const weekDays = plan.nutrition.days
      .filter((day) => day.weekIndex === weekIndex)
      .sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek));

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
        <EmptyState
          title="No hay plan cargado"
          description="Importa un archivo para empezar a seleccionar menus."
        />
        <Link
          href="/import"
          className="inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Ir a importar
        </Link>
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
        <div className="space-y-1 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">{formatDayLabel(isoDate)}</p>
          <p>
            Menus seleccionados: {selectedCount}/1
          </p>
          <p>
            Menus hechos: {doneCount}/1
          </p>
          <p className="text-xs text-zinc-500">Opciones disponibles esta semana: {totalMenus}</p>
        </div>
      </Card>

      <Card title="Menu completo del dia">
        <div className="space-y-3">
          {selectedDailyMenuOption ? (
            <div className="rounded-xl bg-zinc-100 p-3">
              <p className="text-sm font-semibold text-zinc-900">
                {selectedDailyMenuOption.optionLabel}
              </p>
              <p className="text-xs text-zinc-500">
                Basado en columna {selectedDailyMenuOption.sourceDayOfWeek}
              </p>
              <ul className="mt-2 space-y-2 text-xs text-zinc-700">
                {selectedDailyMenuOption.meals.map((meal) => (
                  <li key={meal.mealType}>
                    <p className="font-medium text-zinc-900">{meal.mealType}</p>
                    <p>{meal.lines.join(" | ")}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">Sin menu seleccionado.</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
              onClick={() => setIsSheetOpen(true)}
            >
              Elegir menu
            </button>
            <button
              type="button"
              className={[
                "rounded-xl px-3 py-2 text-sm font-medium",
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
        <div className="space-y-2">
          {dailyMenuOptions.map((option) => (
            <div
              key={option.optionId}
              className="relative"
              onMouseEnter={() => setHoveredOptionId(option.optionId)}
              onMouseLeave={() => setHoveredOptionId((current) => (current === option.optionId ? null : current))}
            >
              <button
                type="button"
                className={[
                  "w-full rounded-xl border px-3 py-2 text-left",
                  selectedDailyMenuOptionId === option.optionId
                    ? "border-zinc-900 bg-zinc-100"
                    : "border-zinc-300 bg-white",
                ].join(" ")}
                onClick={() => {
                  updateDailyMenuSelection({ selectedDayOptionId: option.optionId });
                  setIsSheetOpen(false);
                }}
              >
                <p className="text-sm font-medium text-zinc-900">{option.optionLabel}</p>
                <p className="text-xs text-zinc-500">Columna origen: {option.sourceDayOfWeek}</p>
                <p className="mt-1 text-xs text-zinc-600">
                  {option.meals
                    .slice(0, 3)
                    .map((meal) => `${meal.mealType}: ${meal.lines[0] ?? ""}`)
                    .join(" | ")}
                </p>
              </button>

              {hoveredOptionId === option.optionId ? (
                <div className="pointer-events-none absolute left-2 right-2 top-[calc(100%+0.35rem)] z-20 hidden rounded-xl border border-zinc-300 bg-white p-3 shadow-lg md:block">
                  <p className="text-xs font-semibold text-zinc-900">Vista completa</p>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                    {option.meals.map((meal) => (
                      <li key={`${option.optionId}-${meal.mealType}`}>
                        <span className="font-medium text-zinc-900">{meal.mealType}: </span>
                        <span>{meal.lines.join(" | ")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
