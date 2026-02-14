import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  children: ReactNode;
};

export default function Card({ title, children }: CardProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      {title ? <h2 className="text-base font-semibold text-zinc-900">{title}</h2> : null}
      <div className={title ? "mt-3" : ""}>{children}</div>
    </section>
  );
}
