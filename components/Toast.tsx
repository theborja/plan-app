"use client";

type ToastProps = {
  message: string | null;
  tone?: "success" | "error" | "info";
  onClose?: () => void;
};

export default function Toast({ message, tone = "info", onClose }: ToastProps) {
  if (!message) return null;

  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "error"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--muted)]";

  return (
    <div className={`rounded-xl border px-3 py-2 text-sm shadow-[var(--shadow-soft)] ${toneClass}`}>
      <div className="flex items-start justify-between gap-2">
        <p>{message}</p>
        {onClose ? (
          <button
            type="button"
            className="rounded-md bg-white/70 px-2 py-0.5 text-xs"
            onClick={onClose}
          >
            Cerrar
          </button>
        ) : null}
      </div>
    </div>
  );
}
