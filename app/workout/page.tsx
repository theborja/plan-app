"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import NoPlanState from "@/components/NoPlanState";
import Skeleton from "@/components/Skeleton";
import { fetchJson, postJson } from "@/lib/clientApi";
import { formatDateShortSpanish, getDayOfWeek, getLocalISODate, getNextTrainingDay } from "@/lib/date";

type DayPayload = {
  noPlan?: boolean;
  trainingDay: {
    id: string;
    dayIndex: number;
    label: string;
    exercises: Array<{
      id: string;
      exerciseIndex: number;
      name: string;
      sets: number | null;
      reps: string | null;
      restSeconds: number | null;
      notes: string | null;
    }>;
  } | null;
  session: {
    id: string;
    note: string;
    setLogsByExerciseId: Record<string, Array<{ setNumber: number; weightKg: number | null }>>;
  } | null;
  settings: {
    trainingDays: Array<"Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun">;
  };
};

type DraftWeights = Record<string, string[]>;

type SaveResponse = {
  ok: true;
  sessionId: string;
  savedSetLogs: number;
};

function formatRest(restSeconds?: number | null): string {
  if (restSeconds === undefined || restSeconds === null) return "-";
  if (restSeconds < 60) return `${restSeconds}s`;
  const min = Math.floor(restSeconds / 60);
  const sec = restSeconds % 60;
  return sec === 0 ? `${min}min` : `${min}min ${sec}s`;
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

function buildDraftFromPayload(payload: DayPayload | null): { note: string; weights: DraftWeights } {
  if (!payload?.trainingDay) {
    return { note: "", weights: {} };
  }

  const note = payload.session?.note ?? "";
  const weights: DraftWeights = {};

  for (const exercise of payload.trainingDay.exercises) {
    const seriesCount = Math.max(1, exercise.sets ?? 1);
    const logs = payload.session?.setLogsByExerciseId[exercise.id] ?? [];
    const arr = Array.from({ length: seriesCount }, () => "");

    for (const log of logs) {
      const idx = log.setNumber - 1;
      if (idx >= 0 && idx < arr.length) {
        arr[idx] = log.weightKg === null ? "" : String(log.weightKg);
      }
    }

    weights[exercise.id] = arr;
  }

  return { note, weights };
}

export default function WorkoutPage() {
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(getLocalISODate());
  const [data, setData] = useState<DayPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftWeights, setDraftWeights] = useState<DraftWeights>({});

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const payload = await fetchJson<DayPayload>(`/api/workout/day?date=${selectedIsoDate}`);
        setData(payload);
        const draft = buildDraftFromPayload(payload);
        setDraftNote(draft.note);
        setDraftWeights(draft.weights);
        setIsDirty(false);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [selectedIsoDate]);

  function setDateWithGuard(nextDate: string) {
    if (nextDate === selectedIsoDate) return;
    if (isDirty) {
      const ok = window.confirm("Tienes cambios sin guardar. Si cambias de fecha los perderas. ¿Continuar?");
      if (!ok) return;
    }
    setSelectedIsoDate(nextDate);
  }

  function updateWeight(exerciseId: string, setIndex: number, value: string) {
    setDraftWeights((prev) => {
      const current = prev[exerciseId] ?? [];
      const next = [...current];
      next[setIndex] = value;
      return { ...prev, [exerciseId]: next };
    });
    setIsDirty(true);
  }

  function updateNote(note: string) {
    setDraftNote(note);
    setIsDirty(true);
  }

  async function saveWorkout() {
    if (!data?.trainingDay) return;

    setIsSaving(true);
    try {
      const setLogs: Array<{ exerciseId: string; setNumber: number; weightKg: number }> = [];

      for (const exercise of data.trainingDay.exercises) {
        const values = draftWeights[exercise.id] ?? [];
        values.forEach((raw, idx) => {
          const trimmed = raw.trim();
          if (!trimmed) return;
          const parsed = Number(trimmed.replace(",", "."));
          if (!Number.isFinite(parsed)) return;
          setLogs.push({
            exerciseId: exercise.id,
            setNumber: idx + 1,
            weightKg: parsed,
          });
        });
      }

      await postJson<SaveResponse>("/api/workout/save", {
        dateISO: selectedIsoDate,
        note: draftNote,
        setLogs,
      });

      setIsDirty(false);
    } catch (error) {
      // Keep UI clean; guardado errors are intentionally silent in this header.
      void error;
    } finally {
      setIsSaving(false);
    }
  }

  const dayOfWeek = getDayOfWeek(selectedIsoDate);
  const trainingWeekdays = data?.settings.trainingDays ?? [];
  const trainingToday = trainingWeekdays.includes(dayOfWeek as (typeof trainingWeekdays)[number]);
  const nextTraining = trainingWeekdays.length > 0 ? getNextTrainingDay(selectedIsoDate, trainingWeekdays) : null;

  const dayPicker = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded-xl bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]"
        onClick={() => setDateWithGuard(addDays(selectedIsoDate, -1))}
      >
        Dia anterior
      </button>
      <button
        type="button"
        className="rounded-xl bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--muted)]"
        onClick={() => setDateWithGuard(addDays(selectedIsoDate, 1))}
      >
        Dia siguiente
      </button>
      <input
        type="date"
        value={selectedIsoDate}
        onChange={(e) => setDateWithGuard(e.target.value)}
        className="ml-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
      />
    </div>
  );

  const highlightedDayPicker = (
    <div className="rounded-xl border border-[color:color-mix(in_oklab,var(--primary-end)_45%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface-soft)_75%,var(--primary-end)_25%)] p-2">
      {dayPicker}
    </div>
  );

  if (isLoading) {
    return (
      <Card title="Cargando entreno">
        <Skeleton lines={4} />
      </Card>
    );
  }

  if (data?.noPlan) {
    return <NoPlanState />;
  }

  if (!trainingToday) {
    return (
      <div className="space-y-4">
        <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_oklab,var(--primary-end)_50%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_82%,var(--primary-end)_18%)] p-4 shadow-[0_10px_24px_rgba(108,93,211,0.16)] animate-card">
          <h2 className="text-base font-semibold text-[var(--foreground)]">Fecha de consulta</h2>
          <div className="mt-3">{highlightedDayPicker}</div>
        </section>

        <Card title="Entreno de hoy" subtitle="Dia de descanso">
          <p className="text-sm font-semibold text-[var(--foreground)]">Descanso</p>
          {nextTraining ? <p className="mt-2 text-sm text-[var(--muted)]">Proximo entreno: {formatDateShortSpanish(nextTraining.isoDate)}</p> : null}
        </Card>
        <EmptyState title="El musculo crece en el descanso" description="Descansar es importante, amigo." />
      </div>
    );
  }

  if (!data?.trainingDay) {
    return <Card title="Entreno de hoy"><p className="text-sm text-[var(--muted)]">No se encontro rutina para hoy.</p></Card>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_oklab,var(--primary-end)_50%,var(--border))] bg-[color:color-mix(in_oklab,var(--surface)_82%,var(--primary-end)_18%)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">{data.trainingDay.label}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{formatDateShortSpanish(selectedIsoDate)}</p>
          </div>
          <button
            type="button"
            onClick={() => void saveWorkout()}
            disabled={isSaving || !isDirty}
            className="rounded-xl bg-gradient-to-r from-[var(--primary-start)] to-[var(--primary-end)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {isSaving ? "Guardando..." : "Guardar datos"}
          </button>
        </div>

        <div className="mt-2">{highlightedDayPicker}</div>
      </section>

      {data.trainingDay.exercises.map((exercise) => {
        const seriesCount = Math.max(1, exercise.sets ?? 1);
        const values = draftWeights[exercise.id] ?? Array.from({ length: seriesCount }, () => "");

        return (
          <Card key={exercise.id}>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">{exercise.name}</p>
              <div className="grid grid-cols-3 gap-2 text-xs text-[var(--muted)]">
                <p className="rounded-lg bg-[var(--surface-soft)] px-2 py-1">Series: {exercise.sets ?? "-"}</p>
                <p className="rounded-lg bg-[var(--surface-soft)] px-2 py-1">Reps: {exercise.reps ?? "-"}</p>
                <p className="rounded-lg bg-[var(--surface-soft)] px-2 py-1">Descanso: {formatRest(exercise.restSeconds)}</p>
              </div>
              <div className={["grid gap-1.5", seriesCount >= 4 ? "grid-cols-4" : "grid-cols-3"].join(" ")}>
                {Array.from({ length: seriesCount }, (_, idx) => (
                  <input
                    key={`${exercise.id}-${idx}`}
                    type="text"
                    inputMode="decimal"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
                    placeholder={`S${idx + 1}`}
                    value={values[idx] ?? ""}
                    onChange={(event) => updateWeight(exercise.id, idx, event.target.value)}
                  />
                ))}
              </div>
              {exercise.notes ? <p className="text-xs text-[var(--muted)]">{exercise.notes}</p> : null}
            </div>
          </Card>
        );
      })}

      <Card title="Nota del entreno">
        <textarea
          className="min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          placeholder="Como te fue hoy..."
          value={draftNote}
          onChange={(event) => updateNote(event.target.value)}
        />
      </Card>
    </div>
  );
}
