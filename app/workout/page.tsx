"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Skeleton from "@/components/Skeleton";
import { useAuth } from "@/hooks/useAuth";
import {
  getActivePlanHybrid,
  hydrateWorkoutHybrid,
  saveWorkoutHybrid,
} from "@/lib/adapters/hybrid";
import {
  formatDateShortSpanish,
  getAutoTrainingWeekdays,
  getDayOfWeek,
  getLocalISODate,
  getNextTrainingDay,
  isTrainingDay,
} from "@/lib/date";
import { resolveTrainingDay } from "@/lib/planResolver";
import { buildProgressBlocks, withMockProgressData } from "@/lib/progress";
import { loadSelectionsV1, loadSettingsV1, saveSelectionsV1 } from "@/lib/storage";
import type { PlanV1, SelectionsV1, SettingsV1 } from "@/lib/types";

function formatRest(restSeconds?: number | null): string {
  if (restSeconds === undefined || restSeconds === null) return "-";
  if (restSeconds < 60) return `${restSeconds}s`;
  const min = Math.floor(restSeconds / 60);
  const sec = restSeconds % 60;
  return sec === 0 ? `${min}min` : `${min}min ${sec}s`;
}

function splitStoredSeriesWeights(value: string | undefined, seriesCount: number): string[] {
  const count = Math.max(1, seriesCount);
  if (!value || !value.trim()) {
    return Array.from({ length: count }, () => "");
  }

  const parts = value.includes("||")
    ? value.split("||").map((part) => part.trim())
    : [value.trim()];

  const normalized = Array.from({ length: count }, (_, index) => parts[index] ?? "");
  return normalized;
}

function joinSeriesWeights(values: string[]): string {
  return values.map((value) => value.trim()).join("||");
}

function addDays(isoDate: string, amount: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + amount);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseWeightSeries(value: string): Array<number | null> {
  if (!value || !value.trim()) return [];
  const parts = value.includes("||") ? value.split("||") : [value];
  return parts.map((part) => {
    const parsed = Number(part.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  });
}

export default function WorkoutPage() {
  const { user } = useAuth();
  const isMockUser = (user?.email ?? "").trim().toLowerCase() === "mock";
  const [plan, setPlan] = useState<PlanV1 | null>(null);
  const [settings, setSettings] = useState<SettingsV1 | null>(null);
  const [selections, setSelections] = useState<SelectionsV1 | null>(null);
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(getLocalISODate());
  const [isLoading, setIsLoading] = useState(true);

  const dayOfWeek = getDayOfWeek(selectedIsoDate);
  const trainingWeekdays =
    settings && settings.trainingDays.length > 0
      ? settings.trainingDays
      : getAutoTrainingWeekdays(plan?.training.days.length ?? 0);
  const trainingToday = isTrainingDay(dayOfWeek, trainingWeekdays);
  const nextTraining = trainingWeekdays.length > 0 ? getNextTrainingDay(selectedIsoDate, trainingWeekdays) : null;

  useEffect(() => {
    setSettings(loadSettingsV1());
    setSelections(loadSelectionsV1());
    setIsLoading(false);
    void (async () => {
      const nextPlan = await getActivePlanHybrid();
      setPlan(nextPlan);
    })();
  }, []);

  useEffect(() => {
    if (!selectedIsoDate) return;
    void (async () => {
      const hydrated = await hydrateWorkoutHybrid(selectedIsoDate);
      setSelections(hydrated);
    })();
  }, [selectedIsoDate]);

  const trainingDay = useMemo(() => {
    if (!plan || !settings || !trainingToday) return null;
    return resolveTrainingDay(plan, selectedIsoDate, settings);
  }, [plan, settings, trainingToday, selectedIsoDate]);

  const mockBlocks = useMemo(() => {
    if (!isMockUser || !plan || !settings || !selections) return [];
    return withMockProgressData(buildProgressBlocks(plan, selections, settings), 3);
  }, [isMockUser, plan, selections, settings]);

  const trainingDayIndexInPlan = useMemo(() => {
    if (!plan || !trainingDay) return -1;
    return plan.training.days.findIndex((day) => day.dayIndex === trainingDay.dayIndex);
  }, [plan, trainingDay]);

  const mockBlockForDay =
    trainingDayIndexInPlan >= 0 ? (mockBlocks[trainingDayIndexInPlan] ?? null) : null;

  const doneIndexes = selections?.byDate?.[selectedIsoDate]?.workout?.doneExerciseIndexes ?? [];
  const lastWeightByExerciseIndex =
    selections?.byDate?.[selectedIsoDate]?.workout?.lastWeightByExerciseIndex ?? {};
  const workoutNote = selections?.byDate?.[selectedIsoDate]?.workout?.note ?? "";

  function updateWorkout(patch: {
    doneExerciseIndexes?: number[];
    note?: string;
    lastWeightByExerciseIndex?: Record<string, string>;
  }) {
    if (!selections) return;

    const next: SelectionsV1 = {
      ...selections,
      byDate: { ...selections.byDate },
    };

    const currentDay = next.byDate[selectedIsoDate] ?? { meals: {} };
    const currentWorkout = currentDay.workout ?? { doneExerciseIndexes: [] };
    next.byDate[selectedIsoDate] = {
      ...currentDay,
      workout: {
        doneExerciseIndexes: [
          ...(patch.doneExerciseIndexes ?? currentWorkout.doneExerciseIndexes),
        ].sort((a, b) => a - b),
        note: patch.note ?? currentWorkout.note,
        lastWeightByExerciseIndex:
          patch.lastWeightByExerciseIndex ?? currentWorkout.lastWeightByExerciseIndex ?? {},
        updatedAtISO: new Date().toISOString(),
      },
    };

    const nextWorkout = next.byDate[selectedIsoDate].workout ?? {
      doneExerciseIndexes: [],
      note: "",
      lastWeightByExerciseIndex: {},
    };

    setSelections(next);
    saveSelectionsV1(next);

    if (trainingDay) {
      const exercisesById = trainingDay.exercises.map((exercise, index) => ({
        exerciseId: exercise.id,
        weights: parseWeightSeries(nextWorkout.lastWeightByExerciseIndex?.[String(index)] ?? ""),
      }));

      void saveWorkoutHybrid({
        dateISO: selectedIsoDate,
        note: nextWorkout.note,
        completed: trainingDay.exercises.length > 0 && nextWorkout.doneExerciseIndexes.length >= trainingDay.exercises.length,
        exercisesById,
      });
    }
  }

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
            description="Importa un plan para ver tu entrenamiento."
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

  const dayPicker = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-lg bg-[var(--surface-soft)] px-2 py-1 text-xs font-semibold text-[var(--muted)]"
        onClick={() => setSelectedIsoDate((prev) => addDays(prev, -1))}
      >
        Dia anterior
      </button>
      <button
        type="button"
        className="rounded-lg bg-[var(--surface-soft)] px-2 py-1 text-xs font-semibold text-[var(--muted)]"
        onClick={() => setSelectedIsoDate((prev) => addDays(prev, 1))}
      >
        Dia siguiente
      </button>
      <input
        type="date"
        className="ml-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)]"
        value={selectedIsoDate}
        onChange={(event) => {
          if (!event.target.value) return;
          setSelectedIsoDate(event.target.value);
        }}
      />
    </div>
  );
  const highlightedDayPicker = (
    <div className="rounded-xl border border-[color:color-mix(in_oklab,var(--primary-end)_45%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface-soft)_75%,var(--primary-end)_25%)] p-2">
      {dayPicker}
    </div>
  );

  if (!trainingToday) {
    return (
      <div className="space-y-4">
        <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_oklab,var(--primary-end)_50%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_82%,var(--primary-end)_18%)] p-4 shadow-[0_10px_24px_rgba(108,93,211,0.16)] animate-card">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Fecha de consulta</h2>
          <div className="mt-3">{highlightedDayPicker}</div>
        </section>
        <Card title="Entreno de hoy" subtitle="Dia de descanso">
          <p className="text-sm font-semibold text-[var(--foreground)]">Descanso</p>
          {nextTraining ? (
            <p className="mt-2 text-sm text-[var(--muted)]">
              Proximo entreno: {formatDateShortSpanish(nextTraining.isoDate)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--muted)]">No hay dias de entrenamiento definidos.</p>
          )}
        </Card>
        <EmptyState
          title="El musculo crece en el descanso"
          description="Descansar es importante, amigo."
        />
      </div>
    );
  }

  if (!trainingDay) {
    return (
      <div className="space-y-4">
        <Card title="Entreno de hoy">
          <p className="text-sm text-[var(--muted)]">
            No se encontro rutina para hoy. Revisa el plan importado.
          </p>
        </Card>
      </div>
    );
  }

  const allDone = trainingDay.exercises.length > 0 && doneIndexes.length === trainingDay.exercises.length;

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_oklab,var(--primary-end)_50%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_82%,var(--primary-end)_18%)] p-4 shadow-[0_10px_24px_rgba(108,93,211,0.16)] animate-card">
        <h2 className="text-base font-semibold text-[var(--foreground)]">{trainingDay.label}</h2>
        <div className="mt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">{formatDateShortSpanish(selectedIsoDate)}</p>
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
              <input
                type="checkbox"
                checked={allDone}
                onChange={(event) => {
                  if (event.target.checked) {
                    updateWorkout({
                      doneExerciseIndexes: trainingDay.exercises.map((_, idx) => idx),
                    });
                  } else {
                    updateWorkout({ doneExerciseIndexes: [] });
                  }
                }}
              />
              Marcar todo
            </label>
          </div>
          <div className="mt-2">{highlightedDayPicker}</div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Hechos: {doneIndexes.length}/{trainingDay.exercises.length}
          </p>
        </div>
      </section>

      {trainingDay.exercises.map((exercise, index) => {
        const isDone = doneIndexes.includes(index);
        const exerciseKey = String(index);
        const storedWeight = lastWeightByExerciseIndex[exerciseKey];
        const seriesCount = Math.max(1, exercise.series ?? 1);
        const mockWeight = mockBlockForDay?.exercises[index]?.points.at(-1)?.weightKg ?? null;
        const mockSeriesFallback =
          mockWeight !== null ? Array.from({ length: seriesCount }, () => String(mockWeight)).join("||") : "";
        const fallbackMostRecent = isMockUser ? mockSeriesFallback : "";
        const seriesWeights = splitStoredSeriesWeights(storedWeight ?? fallbackMostRecent, seriesCount);
        return (
          <Card key={exercise.id || `${trainingDay.dayIndex}-${index}`}>
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-[var(--foreground)]">{exercise.name}</p>
                <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={(event) => {
                      if (event.target.checked) {
                        updateWorkout({ doneExerciseIndexes: [...doneIndexes, index] });
                      } else {
                        updateWorkout({
                          doneExerciseIndexes: doneIndexes.filter(
                            (doneIndex) => doneIndex !== index,
                          ),
                        });
                      }
                    }}
                  />
                  hecho
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-[var(--muted)]">
                <p className="rounded-lg bg-[var(--surface-soft)] px-2 py-1">
                  Series: {exercise.series ?? "-"}
                </p>
                <p className="rounded-lg bg-[var(--surface-soft)] px-2 py-1">
                  Reps: {exercise.reps ?? "-"}
                </p>
                <p className="rounded-lg bg-[var(--surface-soft)] px-2 py-1">
                  Descanso: {formatRest(exercise.restSeconds)}
                </p>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-medium text-[var(--muted)]">Peso por serie</p>
                <div
                  className={[
                    "grid gap-1.5",
                    seriesCount >= 4 ? "grid-cols-4" : "grid-cols-3",
                  ].join(" ")}
                >
                  {seriesWeights.map((weight, setIndex) => (
                    <input
                      key={`${exerciseKey}-${setIndex}`}
                      type="text"
                      inputMode="decimal"
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--foreground)]"
                      placeholder={`S${setIndex + 1}`}
                      value={weight}
                      onChange={(event) => {
                        const nextSeriesWeights = [...seriesWeights];
                        nextSeriesWeights[setIndex] = event.target.value;
                        const allSeriesCompleted = nextSeriesWeights.every(
                          (seriesWeight) => seriesWeight.trim().length > 0,
                        );

                        const nextDoneExerciseIndexes = allSeriesCompleted
                          ? Array.from(new Set([...doneIndexes, index])).sort((a, b) => a - b)
                          : doneIndexes.filter((doneIndex) => doneIndex !== index);

                        const nextWeights = {
                          ...lastWeightByExerciseIndex,
                          [exerciseKey]: joinSeriesWeights(nextSeriesWeights),
                        };
                        updateWorkout({
                          lastWeightByExerciseIndex: nextWeights,
                          doneExerciseIndexes: nextDoneExerciseIndexes,
                        });
                      }}
                    />
                  ))}
                </div>
              </div>

              {exercise.notes && !exercise.notes.includes("|") ? (
                <p className="text-xs text-[var(--muted)]">{exercise.notes}</p>
              ) : null}
            </div>
          </Card>
        );
      })}

      <Card title="Nota del entreno">
        <textarea
          className="min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]"
          placeholder="Como te fue hoy..."
          value={workoutNote}
          onChange={(event) => updateWorkout({ note: event.target.value })}
        />
      </Card>
    </div>
  );
}
