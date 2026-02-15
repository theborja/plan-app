import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--surface-soft)] p-6 text-center shadow-[var(--shadow-soft)]">
      <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
      {description ? <p className="mt-1 text-sm text-[var(--muted)]">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
