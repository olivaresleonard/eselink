import { NextRequest, NextResponse } from 'next/server';

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
};

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim().replace(/,$/, '');
}

function buildAddressCandidates(address: string) {
  const cleaned = compactWhitespace(address);
  const segments = cleaned
    .split(',')
    .map((segment) => compactWhitespace(segment))
    .filter(Boolean);

  const primaryStreet = segments[0] ?? cleaned;
  const city = segments.at(-3) ?? segments.at(-2) ?? '';
  const region = segments.at(-2) ?? '';
  const country = segments.at(-1) ?? 'Chile';

  const strippedStreet = primaryStreet
    .replace(/\b(referencia|depto|departamento|dpto|oficina|of|casa)\b.*$/i, '')
    .replace(/\s+-\s+.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const normalizedRegion = region
    .replace('RM (Metropolitana)', 'Región Metropolitana')
    .replace('Region Metropolitana', 'Región Metropolitana');

  const candidates = new Set<string>([
    cleaned,
    compactWhitespace([strippedStreet, city, normalizedRegion, country].filter(Boolean).join(', ')),
    compactWhitespace([primaryStreet, city, country].filter(Boolean).join(', ')),
    compactWhitespace([strippedStreet, city, country].filter(Boolean).join(', ')),
    compactWhitespace([city, normalizedRegion, country].filter(Boolean).join(', ')),
    compactWhitespace([city, country].filter(Boolean).join(', ')),
  ]);

  return Array.from(candidates).filter(Boolean);
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim();

  if (!address) {
    return NextResponse.json(
      { message: 'Debes enviar una direccion para geocodificar.' },
      { status: 400 },
    );
  }

  let first: NominatimResult | undefined;

  for (const candidate of buildAddressCandidates(address)) {
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.set('format', 'jsonv2');
    nominatimUrl.searchParams.set('limit', '1');
    nominatimUrl.searchParams.set('countrycodes', 'cl');
    nominatimUrl.searchParams.set('addressdetails', '0');
    nominatimUrl.searchParams.set('q', candidate);

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'Accept-Language': 'es-CL,es;q=0.9',
        'User-Agent': 'EseLink/1.0 (operacion-flex)',
      },
      next: {
        revalidate: 60 * 60 * 24 * 7,
      },
    });

    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as NominatimResult[];
    first = payload[0];

    if (first?.lat && first?.lon) {
      break;
    }
  }

  return NextResponse.json({
    lat: first?.lat ? Number(first.lat) : null,
    lng: first?.lon ? Number(first.lon) : null,
    label: first?.display_name ?? null,
  });
}
