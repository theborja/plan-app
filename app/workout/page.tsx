"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import {
  formatDayLabel,
  getDayOfWeek,
  getLocalISODate,
  getNextTrainingDay,
  isTrainingDay,
} from "@/lib/date";
import { loadPlanV1, loadSelectionsV1, loadSettingsV1, saveSelectionsV1 } from "@/lib/storage";
import type { PlanV1, SelectionsV1, SettingsV1 } from "@/lib/types";

function formatRest(restSeconds?: number | null): string {
  if (restSeconds === undefined || restSeconds === null) return "-";
  if (restSeconds < 60) return `${restSeconds}s`;
  const min = Math.floor(restSeconds / 60);
  const sec = restSeconds % 60;
  return sec === 0 ? `${min}min` : `${min}min ${sec}s`;
}

export default function WorkoutPage() {
  const [plan, setPlan] = useState<PlanV1 | null>(null);
  const [settings, setSettings] = useState<SettingsV1 | null>(null);
  const [selections, setSelections] = useState<SelectionsV1 | null>(null);

  const isoDate = getLocalISODate();
  const dayOfWeek = getDayOfWeek(isoDate);
  const trainingToday = isTrainingDay(dayOfWeek);
  const nextTraining = getNextTrainingDay(isoDate);

  useEffect(() => {
    setPlan(loadPlanV1());
    setSettings(loadSettingsV1());
    setSelections(loadSelectionsV1());
  }, []);

  const trainingDay = useMemo(() => {
    if (!plan || !settings || !trainingToday) return null;
    const dayIndex = settings.trainingDayMap[dayOfWeek];
    return (
      plan.training.days.find(
        (day, index) => day.dayIndex === dayIndex || index === dayIndex - 1,
      ) ?? null
    );
  }, [plan, settings, trainingToday, dayOfWeek]);

  const doneIndexes = selections?.byDate?.[isoDate]?.workout?.doneExerciseIndexes ?? [];
  const workoutNote = selections?.byDate?.[isoDate]?.workout?.note ?? "";

  function updateWorkout(nextDoneIndexes: number[], nextNote = workoutNote) {
    if (!selections) return;

    const next: SelectionsV1 = {
      ...selections,
      byDate: { ...selections.byDate },
    };

    const currentDay = next.byDate[isoDate] ?? { meals: {} };
    next.byDate[isoDate] = {
      ...currentDay,
      workout: {
        doneExerciseIndexes: [...nextDoneIndexes].sort((a, b) => a - b),
        note: nextNote,
        updatedAtISO: new Date().toISOString(),
      },
    };

    setSelections(next);
    saveSelectionsV1(next);
  }

  if (!plan) {
    return (
      <div className="space-y-4">
        <EmptyState
          title="No hay plan cargado"
          description="Importa un plan para ver tu entrenamiento."
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

  if (!trainingToday) {
    return (
      <div className="space-y-4">
        <Card title="Entreno de hoy">
          <p className="text-sm font-medium text-zinc-900">Descanso</p>
          <p className="mt-2 text-sm text-zinc-600">
            Proximo entreno: {formatDayLabel(nextTraining.isoDate)} ({nextTraining.dayOfWeek})
          </p>
        </Card>
      </div>
    );
  }

  if (!trainingDay) {
    return (
      <div className="space-y-4">
        <Card title="Entreno de hoy">
          <p className="text-sm text-zinc-600">
            No se encontro rutina para hoy. Revisa el plan importado.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card title={trainingDay.label}>
        <p className="text-sm text-zinc-600">{formatDayLabel(isoDate)}</p>
        <p className="mt-1 text-sm text-zinc-700">
          Hechos: {doneIndexes.length}/{trainingDay.exercises.length}
        </p>
      </Card>

      {trainingDay.exercises.map((exercise, index) => {
        const isDone = doneIndexes.includes(index);
        return (
          <Card key={exercise.id || `${trainingDay.dayIndex}-${index}`}>
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-zinc-900">{exercise.name}</p>
                <label className="flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={(event) => {
                      if (event.target.checked) {
                        updateWorkout([...doneIndexes, index]);
                      } else {
                        updateWorkout(doneIndexes.filter((doneIndex) => doneIndex !== index));
                      }
                    }}
                  />
                  hecho
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs text-zinc-700">
                <p className="rounded-lg bg-zinc-100 px-2 py-1">Series: {exercise.series ?? "-"}</p>
                <p className="rounded-lg bg-zinc-100 px-2 py-1">Reps: {exercise.reps ?? "-"}</p>
                <p className="rounded-lg bg-zinc-100 px-2 py-1">
                  Descanso: {formatRest(exercise.restSeconds)}
                </p>
              </div>

              {exercise.notes ? <p className="text-xs text-zinc-500">{exercise.notes}</p> : null}
            </div>
          </Card>
        );
      })}

      <Card title="Nota del entreno">
        <textarea
          className="min-h-24 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
          placeholder="Como te fue hoy..."
          value={workoutNote}
          onChange={(event) => updateWorkout(doneIndexes, event.target.value)}
        />
      </Card>
    </div>
  );
}
