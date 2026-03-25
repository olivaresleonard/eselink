import type { PlatformCode } from '../types/eselink';
import { formatPlatformLabel } from '../lib/channel-labels';

export function PlatformLogo({
  platform,
  className = 'h-4 w-4',
}: {
  platform?: PlatformCode | null;
  className?: string;
}) {
  if (platform === 'shopify') {
    return (
      <img
        src="/platform-logos/shopify.svg"
        alt=""
        aria-hidden="true"
        className={className}
      />
    );
  }

  if (platform === 'woocommerce') {
    return (
      <img
        src="/platform-logos/woocommerce.svg"
        alt=""
        aria-hidden="true"
        className={className}
      />
    );
  }

  if (platform === 'mercadolibre') {
    return (
      <img
        src="/platform-logos/mercadolibre.png"
        alt=""
        aria-hidden="true"
        className={className}
      />
    );
  }

  return null;
}

export function PlatformBadge({
  platform,
  label,
  className = '',
}: {
  platform?: PlatformCode | null;
  label?: string;
  className?: string;
}) {
  const resolvedLabel = label ?? formatPlatformLabel(platform ?? undefined);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 ${className}`}
    >
      <PlatformLogo platform={platform} className="h-4 w-4 shrink-0" />
      <span>{resolvedLabel}</span>
    </span>
  );
}
