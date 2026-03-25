import type { PlatformCode } from '../types/eselink';

const mercadoLibreCountryLabels: Record<string, string> = {
  MLA: 'Argentina',
  MLB: 'Brasil',
  MLC: 'Chile',
  MCO: 'Colombia',
  MCR: 'Costa Rica',
  MEC: 'Ecuador',
  MLM: 'México',
  MLU: 'Uruguay',
  MLV: 'Venezuela',
  MPE: 'Perú',
  MPT: 'Portugal',
  MRD: 'República Dominicana',
  MPA: 'Panamá',
  MBO: 'Bolivia',
  MGT: 'Guatemala',
  MHN: 'Honduras',
  MNI: 'Nicaragua',
  MSV: 'El Salvador',
  MCU: 'Cuba',
  MPY: 'Paraguay',
};

export function formatPlatformLabel(platform?: PlatformCode) {
  const labels: Record<PlatformCode, string> = {
    mercadolibre: 'Mercado Libre',
    shopify: 'Shopify',
    woocommerce: 'WooCommerce',
  };

  return platform ? labels[platform] : 'Mercado Libre';
}

export function formatChannelDisplayLabel(input?: {
  channelName?: string | null;
  channelId?: string | null;
  countryCode?: string | null;
  platform?: PlatformCode | null;
}) {
  const rawName = input?.channelName?.trim() ?? '';
  const platform = input?.platform ?? null;
  const normalizedCountryCode = input?.countryCode?.trim().toUpperCase() ?? '';
  const normalizedName = rawName.toLowerCase();
  const looksLikeMercadoLibre =
    platform === 'mercadolibre' ||
    normalizedName.includes('mercado libre') ||
    normalizedName === 'meli' ||
    normalizedName === 'mercadolibre' ||
    normalizedCountryCode.startsWith('ML');

  if (looksLikeMercadoLibre && normalizedCountryCode) {
    const countryLabel = mercadoLibreCountryLabels[normalizedCountryCode];

    if (countryLabel) {
      return `MercadoLibre ${countryLabel}`;
    }

    return `MercadoLibre ${normalizedCountryCode}`;
  }

  if (!rawName) {
    if (!input?.channelId) {
      return '';
    }

    return formatPlatformLabel(platform ?? undefined);
  }

  const mercadoLibreMatch = rawName.match(/^Mercado Libre\s+([A-Z]{3})$/i);
  if (mercadoLibreMatch) {
    const countryCode = mercadoLibreMatch[1]!.toUpperCase();
    const countryLabel = mercadoLibreCountryLabels[countryCode];

    if (countryLabel) {
      return `MercadoLibre ${countryLabel}`;
    }

    return `MercadoLibre ${countryCode}`;
  }

  const genericAliases = new Set(['meli', 'mercadolibre', 'mercado libre', 'shopify', 'woocommerce']);

  if (genericAliases.has(normalizedName)) {
    return formatPlatformLabel(platform ?? undefined);
  }

  return rawName;
}
