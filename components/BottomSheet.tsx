"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type BottomSheetProps = {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
};

export default function BottomSheet({
  open,
  title,
  onClose,
  children,
}: BottomSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/45"
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        aria-label="Cerrar panel"
        className="absolute inset-0 h-full w-full"
        onClick={onClose}
      />

      <div className="relative z-50 w-full max-w-md rounded-t-3xl border border-[var(--border)] bg-[var(--surface)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl animate-sheet">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-300" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-[var(--foreground)]">{title ?? "Panel"}</h3>
          <button
            type="button"
            className="h-8 w-8 rounded-full bg-[var(--surface-soft)] text-lg leading-none text-[var(--muted)]"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="Cerrar"
          >
            x
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
