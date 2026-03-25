'use client';

import { ReactNode } from 'react';

function FieldLabel({
  label,
  required,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <label className="mb-1.5 block text-[13px] font-medium text-night">
      {label}
      {required ? <span className="ml-1 text-rose-600">*</span> : null}
    </label>
  );
}

export function FieldGroup({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <FieldLabel label={label} required={required} />
      {children}
    </div>
  );
}

export function inputClassName() {
  return 'w-full rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-2.5 text-[13px] text-night outline-none transition focus:border-sky focus:bg-white';
}

export function FormActions({
  submitLabel,
  submitting,
  onCancel,
}: {
  submitLabel: string;
  submitting?: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-ink/70 transition hover:bg-slate-50"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-xl bg-gradient-to-r from-moss to-aurora px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-moss/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Guardando...' : submitLabel}
      </button>
    </div>
  );
}

export function FormMessage({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'success';
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm ${
        tone === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-rose-200 bg-rose-50 text-rose-700'
      }`}
    >
      {children}
    </div>
  );
}
