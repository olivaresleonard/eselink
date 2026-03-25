'use client';

export function QueryState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[var(--stroke)] bg-[var(--panel-strong)] p-8 text-center shadow-panel">
      <p className="text-sm font-semibold text-night">{title}</p>
      <p className="mt-2 text-sm text-ink/60">{description}</p>
    </div>
  );
}
