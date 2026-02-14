"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import { formatDayLabel, getLocalISODate } from "@/lib/date";
import { resolveNutritionDay } from "@/lib/planResolver";
import {
  defaultSelectionsV1,
  loadPlanV1,
  loadSelectionsV1,
  loadSettingsV1,
  saveSelectionsV1,
} from "@/lib/storage";
import type { MealSelection, MealType, PlanV1, SelectionsV1, SettingsV1 } from "@/lib/types";

const MEAL_TYPES: MealType[] = [
  "DESAYUNO",
  "ALMUERZO",
  "COMIDA",
  "MERIENDA",
  "CENA",
  "POSTRE",
];

export default function TodayPage() {
  const [plan, setPlan] = useState<PlanV1 | null>(null);
  const [settings, setSettings] = useState<SettingsV1 | null>(null);
  const [selections, setSelections] = useState<SelectionsV1>(defaultSelectionsV1());
  const [openMealType, setOpenMealType] = useState<MealType | null>(null);

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

  const nutritionDay = useMemo(() => {
    if (!plan || !settings) return null;
    return resolveNutritionDay(plan, isoDate, settings);
  }, [plan, settings, isoDate]);

  const mealsForToday = useMemo(() => {
    if (!nutritionDay) return [];
    return MEAL_TYPES.map((mealType) => ({
      mealType,
      options: nutritionDay.meals[mealType] ?? [],
    })).filter((meal) => meal.options.length > 0);
  }, [nutritionDay]);

  const daySelections = selections.byDate[isoDate]?.meals ?? {};

  function getSelectedOption(mealType: MealType) {
    const selectedOptionId = daySelections[mealType]?.selectedOptionId;
    if (!selectedOptionId || !nutritionDay) return null;
    return nutritionDay.meals[mealType].find((option) => option.optionId === selectedOptionId) ?? null;
  }

  function updateMealSelection(mealType: MealType, patch: Partial<MealSelection>) {
    setSelections((prev) => {
      const next: SelectionsV1 = {
        ...prev,
        byDate: { ...prev.byDate },
      };

      const currentDay = next.byDate[isoDate] ?? { meals: {} };
      const currentMeal = currentDay.meals[mealType] ?? {};

      next.byDate[isoDate] = {
        meals: {
          ...currentDay.meals,
          [mealType]: {
            ...currentMeal,
            ...patch,
            updatedAtISO: new Date().toISOString(),
          },
        },
      };

      saveSelectionsV1(next);
      return next;
    });
  }

  const totalMeals = mealsForToday.length;
  const selectedCount = mealsForToday.filter((meal) => !!getSelectedOption(meal.mealType)).length;
  const doneCount = mealsForToday.filter((meal) => daySelections[meal.mealType]?.done === true).length;

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

  if (!nutritionDay) {
    return (
      <div className="space-y-4">
        <Card title="Hoy">
          <p className="text-sm text-zinc-600">
            No se pudo resolver el dia nutricional para {formatDayLabel(isoDate)}.
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
            Comidas seleccionadas: {selectedCount}/{totalMeals}
          </p>
          <p>
            Comidas hechas: {doneCount}/{totalMeals}
          </p>
        </div>
      </Card>

      {mealsForToday.map(({ mealType, options }) => {
        const mealSelection = daySelections[mealType];
        const selectedOption = getSelectedOption(mealType);

        return (
          <Card key={mealType} title={mealType}>
            <div className="space-y-3">
              {selectedOption ? (
                <div className="rounded-xl bg-zinc-100 p-3">
                  <p className="text-sm font-medium text-zinc-900">{selectedOption.title}</p>
                  <ul className="mt-2 space-y-1 text-xs text-zinc-700">
                    {selectedOption.lines.map((line, idx) => (
                      <li key={`${selectedOption.optionId}-${idx}`}>- {line}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Sin opcion seleccionada.</p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white"
                  onClick={() => setOpenMealType(mealType)}
                >
                  Elegir
                </button>
                <button
                  type="button"
                  className={[
                    "rounded-xl px-3 py-2 text-sm font-medium",
                    mealSelection?.done
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-200 text-zinc-800",
                  ].join(" ")}
                  onClick={() => updateMealSelection(mealType, { done: !mealSelection?.done })}
                >
                  {mealSelection?.done ? "Hecho" : "Marcar hecho"}
                </button>
              </div>

              <textarea
                className="min-h-20 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                placeholder="Nota de esta comida"
                value={mealSelection?.note ?? ""}
                onChange={(event) => updateMealSelection(mealType, { note: event.target.value })}
              />
            </div>

            <BottomSheet
              open={openMealType === mealType}
              title={`Opciones - ${mealType}`}
              onClose={() => setOpenMealType(null)}
            >
              <div className="space-y-2">
                {options.map((option) => (
                  <button
                    key={option.optionId}
                    type="button"
                    className={[
                      "w-full rounded-xl border px-3 py-2 text-left",
                      mealSelection?.selectedOptionId === option.optionId
                        ? "border-zinc-900 bg-zinc-100"
                        : "border-zinc-300 bg-white",
                    ].join(" ")}
                    onClick={() => {
                      updateMealSelection(mealType, {
                        selectedOptionId: option.optionId,
                      });
                      setOpenMealType(null);
                    }}
                  >
                    <p className="text-sm font-medium text-zinc-900">{option.title}</p>
                    <p className="mt-1 text-xs text-zinc-600">
                      {option.lines.slice(0, 3).join(" | ")}
                    </p>
                  </button>
                ))}
              </div>
            </BottomSheet>
          </Card>
        );
      })}
    </div>
  );
}
