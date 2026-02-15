import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

export default function Card({ title, subtitle, children }: CardProps) {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] animate-card">
      {title ? <h2 className="text-base font-semibold text-[var(--foreground)]">{title}</h2> : null}
      {subtitle ? <p className="mt-1 text-xs text-[var(--muted)]">{subtitle}</p> : null}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </section>
  );
}
