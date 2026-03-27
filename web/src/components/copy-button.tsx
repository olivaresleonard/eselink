'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label,
  className = 'inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700',
  iconClassName = 'h-3 w-3',
}: {
  value: string;
  label: string;
  className?: string;
  iconClassName?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async (event) => {
        event.stopPropagation();
        const didCopy = await copyText(value);
        if (didCopy) {
          setCopied(true);
        }
      }}
      className={className}
      aria-label={copied ? 'Copiado' : label}
      title={copied ? 'Copiado' : label}
    >
      {copied ? <Check className={iconClassName} /> : <Copy className={iconClassName} />}
    </button>
  );
}
