'use client';

import type { ConnectedAccount, OrderRow, PlatformCode } from '../../types/eselink';
import { useQuery } from '@tanstack/react-query';
import { Filter, LoaderCircle, MapPinned, Package2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { inputClassName } from '../../components/form-field';
import { PageShell } from '../../components/page-shell';
import { fetchApi } from '../../lib/api';

const FlexTodayMap = dynamic(
  () => import('../../components/flex-today-map').then((module) => module.FlexTodayMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        Cargando mapa...
      </div>
    ),
  },
);

type OrdersResponse = {
  data: OrderRow[];
  meta?: {
    total?: number;
  };
};

type GeocodeResult = {
  lat: number | null;
  lng: number | null;
  label?: string | null;
};

type StopRow = OrderRow & {
  stopId: string;
  orderCount: number;
  addressLabel: string;
  geocodeQuery: string;
  orderIds: string[];
  stageKey:
    | 'all'
    | 'ready_to_print'
    | 'ready_to_ship'
    | 'shipped'
    | 'delayed'
    | 'rescheduled'
    | 'delivered'
    | 'cancelled';
  stageLabel: string;
};

const GEOCODE_CACHE_KEY = 'flex-today:geocode-cache:v3';

function getCurrentDateInSantiago() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatStageLabel(row: OrderRow) {
  if (row.shippingOverdue) return 'Demorada';
  if (row.shippingStage === 'ready_to_print') return 'Por imprimir';
  if (row.shippingStage === 'ready_to_ship') return 'Por despachar';
  if (row.shippingStage === 'shipped') return 'En tránsito';
  if (row.shippingStage === 'rescheduled') return 'Reprogramada';
  if (row.shippingStage === 'delivered') return 'Entregada';
  if (row.shippingStage === 'cancelled') return 'Cancelada';
  return 'Sin etapa';
}

function getStageKey(row: OrderRow): StopRow['stageKey'] {
  if (row.shippingOverdue) return 'delayed';
  if (row.shippingStage === 'ready_to_print') return 'ready_to_print';
  if (row.shippingStage === 'ready_to_ship') return 'ready_to_ship';
  if (row.shippingStage === 'shipped') return 'shipped';
  if (row.shippingStage === 'rescheduled') return 'rescheduled';
  if (row.shippingStage === 'delivered') return 'delivered';
  if (row.shippingStage === 'cancelled') return 'cancelled';
  return 'all';
}

function buildAddressLabel(row: OrderRow) {
  return [row.shippingAddress1, row.shippingCity, row.shippingRegion, row.shippingCountry]
    .filter(Boolean)
    .join(', ');
}

function sanitizeAddressSegment(value?: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/referencia:.*$/i, '')
    .replace(/\b(depto|departamento|dpto|oficina|of|casa)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .trim()
    .replace(/,$/, '');
}

function buildGeocodeQuery(row: OrderRow) {
  return [
    sanitizeAddressSegment(row.shippingAddress1),
    row.shippingCity,
    row.shippingRegion,
    row.shippingCountry,
  ]
    .filter(Boolean)
    .join(', ');
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Sin hora';
  }

  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago',
  }).format(new Date(value));
}

function getPrimaryShipmentLabel(stop: Pick<StopRow, 'packId' | 'externalOrderId'>) {
  return stop.packId ?? stop.externalOrderId;
}

function getShippingOperatorLabel(order: Pick<OrderRow, 'platform' | 'shippingType'>) {
  if (order.platform === 'mercadolibre' && order.shippingType === 'flex') {
    return 'Mercado Libre Flex';
  }

  if (order.platform === 'mercadolibre' && order.shippingType === 'mercado_envios') {
    return 'Mercado Envíos';
  }

  return 'Sin transportista';
}

export default function FlexTodayPage() {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [pendingCities, setPendingCities] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<StopRow['stageKey']>('all');
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [geocodeCache, setGeocodeCache] = useState<Record<string, GeocodeResult>>({});
  const [isCityFilterOpen, setIsCityFilterOpen] = useState(false);

  const accountsQuery = useQuery({
    queryKey: ['accounts'],
    queryFn: () => fetchApi<ConnectedAccount[]>('/accounts'),
    refetchOnWindowFocus: false,
  });

  const ordersQuery = useQuery({
    queryKey: ['flex-today-orders'],
    queryFn: () =>
      fetchApi<OrdersResponse>(
        `/orders?limit=500&onlyShippingToday=true&shippingDate=${getCurrentDateInSantiago()}`,
      ),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GEOCODE_CACHE_KEY);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored) as Record<string, GeocodeResult>;
      if (parsed && typeof parsed === 'object') {
        setGeocodeCache(parsed);
      }
    } catch {
      // ignore broken cache
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(geocodeCache));
    } catch {
      // ignore quota errors
    }
  }, [geocodeCache]);

  const stops = useMemo(() => {
    const rows = ordersQuery.data?.data ?? [];
    const filteredRows = rows.filter(
      (row) =>
        row.platform === 'mercadolibre' &&
        row.shippingType === 'flex' &&
        (!selectedAccountId || row.accountId === selectedAccountId),
    );

    const grouped = new Map<string, StopRow>();

    for (const row of filteredRows) {
      const stopId = row.packId ?? row.externalOrderId;
      const addressLabel = buildAddressLabel(row);
      const geocodeQuery = buildGeocodeQuery(row);
      const existing = grouped.get(stopId);

      if (!existing) {
        grouped.set(stopId, {
          ...row,
          stopId,
          addressLabel,
          geocodeQuery,
          orderIds: [row.id],
          orderCount: 1,
          stageKey: getStageKey(row),
          stageLabel: formatStageLabel(row),
        });
        continue;
      }

      grouped.set(stopId, {
        ...existing,
        totalAmount: existing.totalAmount + row.totalAmount,
        totalUnits: (existing.totalUnits ?? 0) + (row.totalUnits ?? 0),
        orderCount: existing.orderCount + 1,
        orderIds: [...existing.orderIds, row.id],
      });
    }

    return Array.from(grouped.values()).sort((left, right) => {
      const leftTime = left.placedAt ? new Date(left.placedAt).getTime() : 0;
      const rightTime = right.placedAt ? new Date(right.placedAt).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [ordersQuery.data, selectedAccountId]);

  const stageScopedStops = useMemo(
    () => stops.filter((stop) => stageFilter === 'all' || stop.stageKey === stageFilter),
    [stageFilter, stops],
  );

  const visibleStops = useMemo(
    () =>
      stageScopedStops.filter(
        (stop) => selectedCities.length === 0 || selectedCities.includes(stop.shippingCity ?? ''),
      ),
    [selectedCities, stageScopedStops],
  );

  const previewVisibleStopsCount = useMemo(
    () =>
      stageScopedStops.filter(
        (stop) => pendingCities.length === 0 || pendingCities.includes(stop.shippingCity ?? ''),
      ).length,
    [pendingCities, stageScopedStops],
  );

  const previewMappedStopsCount = useMemo(
    () =>
      stageScopedStops.filter((stop) => {
        if (pendingCities.length > 0 && !pendingCities.includes(stop.shippingCity ?? '')) {
          return false;
        }

        const geocode = geocodeCache[stop.stopId];
        return Boolean(geocode?.lat && geocode?.lng);
      }).length,
    [geocodeCache, pendingCities, stageScopedStops],
  );

  const orderedStops = visibleStops;

  useEffect(() => {
    if (!selectedStopId || visibleStops.some((stop) => stop.stopId === selectedStopId)) {
      return;
    }

    setSelectedStopId(visibleStops[0]?.stopId ?? null);
  }, [selectedStopId, visibleStops]);

  useEffect(() => {
    if (selectedStopId || visibleStops.length === 0) {
      return;
    }

    const [firstStop] = visibleStops;
    if (firstStop) {
      setSelectedStopId(firstStop.stopId);
    }
  }, [selectedStopId, visibleStops]);

  useEffect(() => {
    const pending = visibleStops.filter(
      (stop) => stop.geocodeQuery && geocodeCache[stop.stopId] === undefined,
    );

    if (pending.length === 0) {
      return;
    }

    let cancelled = false;

    async function run() {
      for (const stop of pending) {
        try {
          const response = await fetch(
            `/api/geocode?address=${encodeURIComponent(stop.geocodeQuery)}`,
          );
          const payload = (await response.json()) as GeocodeResult;

          if (cancelled) {
            return;
          }

          setGeocodeCache((current) => ({
            ...current,
            [stop.stopId]: payload,
          }));
        } catch {
          if (cancelled) {
            return;
          }

          setGeocodeCache((current) => ({
            ...current,
            [stop.stopId]: { lat: null, lng: null, label: null },
          }));
        }

        await new Promise((resolve) => setTimeout(resolve, 180));
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [geocodeCache, visibleStops]);

  const mappedStops = useMemo(
    () =>
      orderedStops
        .map((stop) => {
          const geocode = geocodeCache[stop.stopId];
          if (!geocode?.lat || !geocode?.lng) {
            return null;
          }

          return {
            id: stop.stopId,
            lat: geocode.lat,
            lng: geocode.lng,
            title: stop.customerName ?? stop.orderNumber,
            customerName: stop.customerName ?? 'Cliente sin nombre',
            address: stop.addressLabel,
            stageLabel: stop.stageLabel,
            selected: stop.stopId === selectedStopId,
          };
        })
        .filter((stop): stop is NonNullable<typeof stop> => Boolean(stop)),
    [geocodeCache, orderedStops, selectedStopId],
  );

  const accountOptions = useMemo(
    () =>
      (accountsQuery.data ?? []).filter(
        (account) => account.platform === 'mercadolibre' && account.status === 'active',
      ),
    [accountsQuery.data],
  );

  const cityOptions = useMemo(
    () => {
      const counts = new Map<string, number>();

      for (const stop of stageScopedStops) {
        if (!stop.shippingCity) {
          continue;
        }

        counts.set(stop.shippingCity, (counts.get(stop.shippingCity) ?? 0) + 1);
      }

      return Array.from(counts.entries())
        .map(([city, count]) => ({ city, count }))
        .sort((left, right) => left.city.localeCompare(right.city, 'es-CL'));
    },
    [stageScopedStops],
  );

  useEffect(() => {
    setSelectedCities((current) =>
      current.filter((city) => cityOptions.some((option) => option.city === city)),
    );
  }, [cityOptions]);

  useEffect(() => {
    setPendingCities((current) =>
      current.filter((city) => cityOptions.some((option) => option.city === city)),
    );
  }, [cityOptions]);

  useEffect(() => {
    if (!isCityFilterOpen) {
      return;
    }

    setPendingCities(selectedCities);
  }, [isCityFilterOpen, selectedCities]);

  const activeCitySummary = isCityFilterOpen ? pendingCities : selectedCities;
  const activeStopsCount = isCityFilterOpen ? previewVisibleStopsCount : visibleStops.length;
  const activeMappedCount = isCityFilterOpen ? previewMappedStopsCount : mappedStops.length;

  const stageTabs = [
    { value: 'all', label: 'Todas' },
    { value: 'ready_to_print', label: 'Por imprimir' },
    { value: 'ready_to_ship', label: 'Por despachar' },
    { value: 'shipped', label: 'En tránsito' },
    { value: 'delayed', label: 'Demoradas' },
    { value: 'rescheduled', label: 'Reprogramadas' },
    { value: 'delivered', label: 'Entregadas' },
    { value: 'cancelled', label: 'Canceladas' },
  ] as const;

  const actionContent = (
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-[220px]">
        <span className="mb-2 block text-sm text-slate-500">Cuenta</span>
        <select
          value={selectedAccountId}
          onChange={(event) => setSelectedAccountId(event.target.value)}
          className={`${inputClassName} min-w-[220px]`}
        >
          <option value="">Todas las cuentas</option>
          {accountOptions.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <PageShell
      title="Flex de hoy"
      description="Vista operativa con mapa y direcciones de las entregas flex del día."
      actionContent={actionContent}
    >
      <div className="space-y-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {stageTabs.map((tab) => {
            const count =
              tab.value === 'all'
                ? stops.length
                : stops.filter((stop) => stop.stageKey === tab.value).length;

            const active = stageFilter === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStageFilter(tab.value)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
                  active
                    ? 'border-night bg-night text-white'
                    : 'border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {tab.label}
                <span className={active ? 'text-white/75' : 'text-slate-400'}>{count}</span>
              </button>
            );
          })}
        </div>

        <section className="grid h-[calc(100vh-205px)] gap-4 xl:grid-cols-[370px_minmax(0,1fr)]">
          <div className="flex min-h-0 flex-col rounded-[2rem] border border-white/55 bg-white/78 shadow-panel backdrop-blur">
            <div className="border-b border-slate-100 px-5 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                  Envíos
                </p>
                <span className="text-slate-300">|</span>
                <p className="font-medium text-slate-500">{visibleStops.length} paradas</p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5">
              {ordersQuery.isLoading ? (
                <div className="flex h-full items-center justify-center text-slate-500">
                  <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
                  Cargando entregas flex...
                </div>
              ) : visibleStops.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-slate-500">
                  <Package2 className="h-8 w-8 text-slate-300" />
                  <p className="mt-3 font-semibold text-slate-700">No hay entregas flex visibles</p>
                  <p className="mt-1 text-sm">Cambia la cuenta o la etapa para ver más paradas.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {orderedStops.map((stop) => {
                    const selected = stop.stopId === selectedStopId;
                    const geocoded = geocodeCache[stop.stopId];

                    return (
                      <button
                        key={stop.stopId}
                        type="button"
                        onClick={() => setSelectedStopId(stop.stopId)}
                        className={`w-full rounded-[1.2rem] border px-3 py-2.5 text-left transition ${
                          selected
                            ? 'border-night bg-night text-white shadow-lg shadow-night/15'
                            : 'border-slate-200 bg-white/85 text-slate-900 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`text-base font-semibold tracking-tight ${selected ? 'text-white' : 'text-slate-900'}`}>
                              {getPrimaryShipmentLabel(stop)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              selected ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {stop.stageLabel}
                          </span>
                        </div>

                        <div className={`mt-2 flex items-start gap-2 ${selected ? 'text-white' : 'text-slate-900'}`}>
                          <MapPinned
                            className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? 'text-white/80' : 'text-slate-400'}`}
                          />
                          <p className="text-[0.92rem] font-medium leading-5">
                            {stop.addressLabel || 'Sin dirección disponible'}
                          </p>
                        </div>

                        <div
                          className={`mt-2.5 flex items-center justify-between gap-3 text-[13px] ${
                            selected ? 'text-white/72' : 'text-slate-500'
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span>{stop.shippingCity || 'Sin comuna'}</span>
                            <span>{getShippingOperatorLabel(stop)}</span>
                          </div>
                          <span>{formatDateTime(stop.placedAt)}</span>
                        </div>

                        <div
                          className={`mt-1 flex items-center justify-between gap-3 text-[13px] ${
                            selected ? 'text-white/72' : 'text-slate-500'
                          }`}
                        >
                          <span>{stop.totalUnits ?? 0} un.</span>
                          <span>{stop.shipmentId ? `Envío ${stop.shipmentId}` : 'Sin envío'}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-[2rem] border border-white/55 bg-white/78 shadow-panel backdrop-blur">
            <div className="border-b border-slate-100 px-5 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                Mapa
              </p>
              <div className="mt-1 flex min-h-[36px] items-center justify-between gap-3 text-sm text-slate-500">
                <div className="min-w-0 truncate">
                  <span className="font-medium text-slate-700">
                    {activeCitySummary.length === 0
                      ? 'Todas las comunas'
                      : activeCitySummary.length <= 2
                        ? activeCitySummary.join(' · ')
                        : `${activeCitySummary.slice(0, 2).join(' · ')} +${activeCitySummary.length - 2}`}
                  </span>
                  <span className="mx-2 text-slate-300">·</span>
                  <span>{activeStopsCount} paradas</span>
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCityFilterOpen((current) => !current)}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition ${
                      isCityFilterOpen || selectedCities.length > 0
                        ? 'border-night bg-night text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900'
                    }`}
                    aria-label="Filtrar comunas"
                    title="Filtrar comunas"
                  >
                    <Filter className="h-4 w-4" />
                  </button>

                  {isCityFilterOpen ? (
                    <div className="absolute right-0 z-[500] mt-3 w-[320px] rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/10">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">Comunas visibles</p>
                        <button
                          type="button"
                          onClick={() => setPendingCities([])}
                          className="text-xs font-semibold text-sky transition hover:text-night"
                        >
                          Todas
                        </button>
                      </div>

                      <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                        <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-200 hover:bg-slate-50">
                          <span className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={pendingCities.length === 0}
                              onChange={() => setPendingCities([])}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <span className="font-medium">Todas las comunas</span>
                          </span>
                          <span className="text-xs font-semibold text-slate-400">{stageScopedStops.length}</span>
                        </label>
                        {cityOptions.map((option) => {
                          const checked = pendingCities.includes(option.city);

                          return (
                            <label
                              key={option.city}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-2 text-sm text-slate-700 transition hover:border-slate-200 hover:bg-slate-50"
                            >
                              <span className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setPendingCities((current) =>
                                      checked
                                        ? current.filter((item) => item !== option.city)
                                        : [...current, option.city],
                                    )
                                  }
                                  className="h-4 w-4 rounded border-slate-300"
                                />
                                <span className="font-medium">{option.city}</span>
                              </span>
                              <span className="text-xs font-semibold text-slate-400">{option.count}</span>
                            </label>
                          );
                        })}
                      </div>
                      <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPendingCities(selectedCities);
                            setIsCityFilterOpen(false);
                          }}
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCities(pendingCities);
                            setIsCityFilterOpen(false);
                          }}
                          className="rounded-full border border-night bg-night px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                        >
                          Aplicar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {mappedStops.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center text-slate-500">
                  <MapPinned className="h-10 w-10 text-slate-300" />
                  <p className="mt-3 text-lg font-semibold text-slate-700">Aún no hay puntos listos en el mapa</p>
                  <p className="mt-1 text-sm">
                    Estamos ubicando las direcciones flex de hoy para mostrarlas en el recorrido.
                  </p>
                </div>
              ) : (
                <FlexTodayMap points={mappedStops} onSelect={setSelectedStopId} />
              )}
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
