'use client';

import { ReactNode } from 'react';

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-night/55 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-[101] flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-6 shadow-[0_28px_90px_rgba(15,23,42,0.22)]">
        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_55%),radial-gradient(circle_at_top_right,rgba(34,197,94,0.12),transparent_52%)] pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 pb-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.03em] text-night">
              {title}
            </h2>
            {description ? (
              <div className="mt-2 text-[15px] font-medium text-ink/70">{description}</div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white/95 px-4 py-1.5 text-[13px] font-medium text-ink/70 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:text-night"
          >
            Cerrar
          </button>
        </div>
        <div className="mt-5 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}
