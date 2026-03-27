import type { PlatformCode, OrderRow } from '../types/eselink';
import { fetchApi } from './api';

type ApiOrderRow = OrderRow & {
  totalAmount: number | string;
  profitAmount?: number | string | null;
  account?: string;
  placedAt?: string | null;
  importedAt?: string | null;
  isNew?: boolean;
  productTitle?: string | null;
  productImageUrl?: string | null;
  shippingType?: 'flex' | 'mercado_envios' | null;
  shippingDeliveredAt?: string | null;
  packId?: string | null;
  purchaseGroupId?: string;
};

type OrdersResponse = {
  data: ApiOrderRow[];
  meta?: {
    total?: number;
    pendingCount?: number;
    purchaseCount?: number;
  };
};

export type OrdersQueryData = {
  rows: ApiOrderRow[];
  meta: NonNullable<OrdersResponse['meta']>;
};

export function getLocalDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function getOrdersDatasetQueryKey(
  filter: 'all' | 'shippingToday' | 'inTransit' | 'finalized',
  shippingDate: string,
  selectedAccountId?: string,
  selectedPlatform?: PlatformCode | '',
) {
  return [
    'orders-page',
    filter,
    ...(filter === 'shippingToday' ? [shippingDate] : []),
    selectedAccountId || 'default',
    selectedPlatform || 'all',
  ];
}

export async function fetchOrdersDataset(
  filter: 'all' | 'shippingToday' | 'inTransit' | 'finalized',
  shippingDate: string,
  selectedAccountId?: string,
  selectedPlatform?: PlatformCode | '',
) {
  const params = new URLSearchParams();
  params.set('limit', '500');
  if (selectedAccountId) {
    params.set('accountId', selectedAccountId);
  }
  if (selectedPlatform) {
    params.set('platform', selectedPlatform);
  }
  if (filter === 'shippingToday') {
    params.set('onlyShippingToday', 'true');
    params.set('shippingDate', shippingDate);
  }

  const response = await fetchApi<OrdersResponse>(
    `/orders${params.size > 0 ? `?${params.toString()}` : ''}`,
  );

  return {
    rows: response.data.map((order) => ({
      ...order,
      totalAmount: Number(order.totalAmount),
      profitAmount:
        order.profitAmount === null || order.profitAmount === undefined
          ? null
          : Number(order.profitAmount),
    })),
    meta: response.meta ?? {},
  } satisfies OrdersQueryData;
}
