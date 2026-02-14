"use client";

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
  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/40"
      aria-modal="true"
      role="dialog"
    >
      <button
        type="button"
        aria-label="Cerrar panel"
        className="absolute inset-0 h-full w-full"
        onClick={onClose}
      />

      <div className="relative z-50 w-full max-w-md rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-zinc-300" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-900">{title ?? "Panel"}</h3>
          <button
            type="button"
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}
