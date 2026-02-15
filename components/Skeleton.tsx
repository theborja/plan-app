"use client";

type SkeletonProps = {
  lines?: number;
};

export default function Skeleton({ lines = 3 }: SkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={`skeleton-${idx}`}
          className="h-3 w-full rounded-full bg-[var(--surface-soft)] animate-pulse"
        />
      ))}
    </div>
  );
}
