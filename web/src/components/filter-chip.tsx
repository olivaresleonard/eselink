import type { ReactNode } from 'react';

type FilterChipProps = {
  label: ReactNode;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  variant?: 'tab' | 'subtle';
  className?: string;
};

function buildCountClassName(active: boolean, variant: 'tab' | 'subtle') {
  return `ml-2 inline-flex items-center justify-center text-[11px] font-semibold tabular-nums ${
    active
      ? variant === 'tab'
        ? 'text-slate-200/80'
        : 'text-slate-700'
      : 'text-slate-400'
  }`;
}

function buildChipClassName(variant: 'tab' | 'subtle', active: boolean, disabled: boolean) {
  const base =
    variant === 'tab'
      ? 'rounded-full px-4 py-2 text-[13px] font-medium transition-colors'
      : 'rounded-full px-3 py-1.5 text-xs font-medium transition-all';

  const tone =
    variant === 'tab'
      ? active
        ? 'border border-slate-900 bg-[linear-gradient(145deg,#0f172a,#1e293b)] text-slate-100'
        : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
      : active
        ? 'border border-slate-300 bg-slate-300 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]'
        : 'border border-transparent bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-700';

  const disabledStyles = disabled ? 'cursor-default opacity-45' : '';

  return [base, tone, disabledStyles].filter(Boolean).join(' ');
}

export function FilterChip({
  label,
  count,
  active = false,
  disabled = false,
  onClick,
  variant = 'subtle',
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={[buildChipClassName(variant, active, disabled), className].filter(Boolean).join(' ')}
    >
      {label}
      {typeof count === 'number' ? (
        <span className={buildCountClassName(active, variant)}>{count}</span>
      ) : null}
    </button>
  );
}
