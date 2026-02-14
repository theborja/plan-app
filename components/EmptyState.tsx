type EmptyStateProps = {
  title: string;
  description?: string;
};

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
      <p className="text-base font-medium text-zinc-900">{title}</p>
      {description ? <p className="mt-1 text-sm text-zinc-600">{description}</p> : null}
    </div>
  );
}
