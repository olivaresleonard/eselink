'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Building2, ChevronDown, Filter, LoaderCircle, MessageSquare, Printer, RefreshCcw } from 'lucide-react';
import { FormEvent, startTransition, useEffect, useMemo, useRef, useState } from 'react';
import type { PlatformCode } from '../../types/eselink';
import { CopyButton } from '../../components/copy-button';
import { DataTable } from '../../components/data-table';
import { FilterChip } from '../../components/filter-chip';
import {
  FieldGroup,
  FormActions,
  FormMessage,
  inputClassName,
} from '../../components/form-field';
import { Modal } from '../../components/modal';
import { PageShell } from '../../components/page-shell';
import { PlatformLogo } from '../../components/platform-brand';
import { QueryState } from '../../components/query-state';
import { ApiError, fetchApi, formatCurrency, postApi } from '../../lib/api';
import { formatPlatformLabel } from '../../lib/channel-labels';
import {
  fetchOrdersDataset,
  getLocalDateKey as getOrdersDateKey,
  getOrdersDatasetQueryKey,
  type OrdersQueryData,
} from '../../lib/orders-query';
import {
  createOrderColumns,
  formatShippingStage,
  getShippingStageIcon,
  getShippingStageTone,
  StatusBadge,
  type OrderTableRow,
} from '../../lib/table-columns';
import type { OrderRow } from '../../types/eselink';

type ApiOrderRow = OrderRow & {
  totalAmount: number | string;
  profitAmount?: number | string | null;
  estimatedNetBeforeCost?: number | string | null;
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

type ShippingStageFilter =
  | 'all'
  | 'ready_to_print'
  | 'ready_to_ship'
  | 'shipped'
  | 'overdue'
  | 'delivered'
  | 'cancelled'
  | 'rescheduled';

type FinalizedStageFilter = 'all' | 'delivered' | 'cancelled' | 'rescheduled';
type FinalizedStage = Exclude<FinalizedStageFilter, 'all'>;
type UpcomingStageFilter = 'all' | 'ready_to_print' | 'ready_to_ship';
type InTransitStageFilter = 'all' | 'shipped' | 'overdue' | 'rescheduled';
type OrderDetailTab = 'products' | 'finance' | 'activity';
type ShippingTypeFilter = 'all' | 'flex' | 'mercado_envios';

type OrderMessageConversation = {
  id?: string;
  resource?: string | null;
  packId?: string | null;
  orderId?: string | null;
  unreadCount: number;
  accountId?: string;
  lastMessage?: {
    text?: string | null;
    createdAt?: string | null;
  } | null;
};

type OrderMessagesResponse = {
  data: OrderMessageConversation[];
};

type RefreshLiveOrdersResponse = {
  accountsProcessed: number;
  importedCount: number;
  skippedCount: number;
  refreshedOpenOrders: number;
  errors: Array<{ accountId: string; message: string }>;
};

type ApiAccount = {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  platform?: PlatformCode;
  channel?: {
    code?: PlatformCode;
  } | null;
};

type OrderDetailResponse = {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    shippingStatus?: string | null;
    shippingStage?:
      | 'ready_to_print'
      | 'ready_to_ship'
      | 'shipped'
      | 'delivered'
      | 'cancelled'
      | 'rescheduled'
      | null;
    customerName?: string | null;
    customerDisplayName?: string | null;
    customerNickname?: string | null;
    shippingName?: string | null;
    shippingAddress1?: string | null;
    shippingAddress2?: string | null;
    shippingCity?: string | null;
    shippingRegion?: string | null;
    shippingPostalCode?: string | null;
    shippingCountry?: string | null;
    placedAt?: string | null;
    totalAmount: number | string;
    currency: string;
  };
  mercadolibreFinancials?: {
    saleBase: number;
    customerShippingAmount: number;
    totalPaidAmount: number;
    marketplaceFee: number;
    taxesAmount: number;
    shippingCost: number;
    bonusAmount: number;
    couponAmount: number;
    installments?: number | null;
    authorizationCode?: string | null;
    estimatedNetBeforeCost: number;
  } | null;
  items: Array<{
    title: string;
    quantity: number;
  }>;
  account?: {
    name?: string | null;
  } | null;
  channel?: {
    name?: string | null;
  } | null;
  assignment?: {
    note?: string | null;
    user?: {
      fullName?: string | null;
      email?: string | null;
    } | null;
  } | null;
  tags?: Array<{
    name?: string | null;
    color?: string | null;
  }>;
  comments?: Array<{
    body?: string | null;
    isInternal?: boolean;
    createdAt?: string;
    user?: {
      fullName?: string | null;
      email?: string | null;
    } | null;
  }>;
};

type PlatformOption = {
  value: PlatformCode;
  label: string;
};

const CANCEL_REASON_OPTIONS = [
  'Me arrepentí de la venta',
  'No tengo el producto disponible',
  'El comprador se arrepintió',
  'Tuve problemas con el envío',
  'Tuve problemas con el correo',
] as const;

function getLocalDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function getRowDateKey(row: Pick<ApiOrderRow, 'placedAt' | 'importedAt' | 'createdAt'>) {
  const referenceDate = row.placedAt ?? row.importedAt ?? row.createdAt ?? null;

  if (!referenceDate) {
    return null;
  }

  const parsedDate = new Date(referenceDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return getLocalDateKey(parsedDate);
}

function getDateKeyFromValue(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return getLocalDateKey(parsedDate);
}

function formatPurchaseTime(value?: string | null) {
  if (!value) {
    return null;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate);
}

function formatOrderShippingTypeLabel(
  shippingType?: 'flex' | 'mercado_envios' | string | null,
) {
  if (!shippingType) {
    return null;
  }

  if (shippingType === 'flex') {
    return 'Flex';
  }

  if (shippingType === 'mercado_envios') {
    return 'Mercado Envíos';
  }

  return shippingType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function selectorClassName() {
  return 'inline-flex h-[42px] w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-4 text-sm text-ink transition hover:border-slate-300 disabled:cursor-default disabled:opacity-60';
}

function matchesShippingTypeFilter(
  row: Pick<OrderTableRow, 'shippingType' | 'individualOrders'>,
  shippingTypeFilter: ShippingTypeFilter,
) {
  if (shippingTypeFilter === 'all') {
    return true;
  }

  if (row.shippingType === shippingTypeFilter) {
    return true;
  }

  return (row.individualOrders ?? []).some((order) => order.shippingType === shippingTypeFilter);
}

function isDeliveredLateOrder(
  order: Pick<ApiOrderRow, 'shippingType' | 'shippingStage' | 'shippingExpectedDate' | 'shippingDeliveredAt'>,
) {
  if (order.shippingType !== 'flex' || order.shippingStage !== 'delivered') {
    return false;
  }

  const expectedDateKey = getDateKeyFromValue(order.shippingExpectedDate);
  const deliveredDateKey = getDateKeyFromValue(order.shippingDeliveredAt);

  return expectedDateKey !== null && deliveredDateKey !== null && expectedDateKey < deliveredDateKey;
}

function canPrintShippingLabel(
  order: Pick<ApiOrderRow, 'shippingStage'>,
) {
  return (
    order.shippingStage === 'ready_to_print' ||
    order.shippingStage === 'ready_to_ship' ||
    order.shippingStage === 'shipped'
  );
}

function getCancellableOrderIds(row: Pick<OrderTableRow, 'id' | 'status' | 'shippingStage' | 'shippingStatus' | 'individualOrders'>) {
  const orders = row.individualOrders?.length
    ? row.individualOrders
    : [
        {
          id: row.id,
          status: row.status,
          shippingStage: row.shippingStage ?? null,
          shippingStatus: row.shippingStatus ?? null,
        },
      ];

  return orders
    .filter((order) => {
      const stage = order.shippingStage?.toLowerCase() ?? '';
      const shippingStatus = order.shippingStatus?.toLowerCase() ?? '';
      const status = order.status?.toLowerCase() ?? '';

      return !['delivered', 'cancelled', 'rescheduled'].includes(stage) &&
        !['delivered', 'cancelled'].includes(shippingStatus) &&
        !['delivered', 'canceled', 'cancelled'].includes(status);
    })
    .map((order) => order.id);
}

function isFlexRescheduledOrder(
  order: Pick<ApiOrderRow, 'shippingType' | 'shippingStage' | 'shippingSubstatus'>,
) {
  return (
    order.shippingType === 'flex' &&
    (order.shippingStage === 'rescheduled' ||
      [
        'rescheduled',
        'reprogrammed',
        'reprogramado',
        'buyer_rescheduled',
        'receiver_absent',
        'rescheduled_by_meli',
      ].includes(order.shippingSubstatus?.toLowerCase() ?? ''))
  );
}

function normalizeImageUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
}

function getModalStatusMeta(row: Pick<OrderTableRow, 'shippingStage' | 'shippingOverdue'>) {
  if (row.shippingOverdue) {
    return {
      label: row.shippingStage === 'delivered' ? 'Entregada demorada' : 'Demorada',
      tone: 'danger' as const,
      icon: getShippingStageIcon(row.shippingStage, {
        overdue: true,
        deliveredLate: row.shippingStage === 'delivered',
      }),
    };
  }

  const label = formatShippingStage(row.shippingStage);

  if (!label) {
    return null;
  }

  return {
    label,
    tone: getShippingStageTone(row.shippingStage),
    icon: getShippingStageIcon(row.shippingStage),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildPrintLabelHtml(detail: OrderDetailResponse) {
  const { order, items, account } = detail;
  const recipient = order.shippingName || order.customerName || 'Cliente';
  const addressLines = [
    order.shippingAddress1,
    order.shippingAddress2,
    [order.shippingCity, order.shippingRegion].filter(Boolean).join(', '),
    [order.shippingPostalCode, order.shippingCountry].filter(Boolean).join(' · '),
  ].filter((line): line is string => Boolean(line && line.trim()));

  const itemsHtml = items
    .map(
      (item) =>
        `<li><strong>${escapeHtml(String(item.quantity))}x</strong> ${escapeHtml(item.title)}</li>`,
    )
    .join('');

  const placedAt = order.placedAt
    ? new Intl.DateTimeFormat('es-CL', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(order.placedAt))
    : 'Sin fecha';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Etiqueta ${escapeHtml(order.orderNumber)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; padding: 24px; font-family: Arial, sans-serif; color: #0f172a; background: #fff; }
      .sheet { width: 100%; max-width: 760px; margin: 0 auto; border: 2px solid #0f172a; padding: 24px; }
      .row { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
      .muted { color: #475569; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
      .value { font-size: 18px; font-weight: 700; margin-top: 6px; }
      .block { margin-top: 20px; padding-top: 20px; border-top: 1px solid #cbd5e1; }
      ul { margin: 12px 0 0; padding-left: 18px; }
      li { margin-bottom: 6px; }
      .total { font-size: 24px; font-weight: 700; }
      @media print { body { padding: 0; } .sheet { border: none; padding: 0; max-width: none; } }
    </style>
  </head>
  <body>
    <main class="sheet">
      <div class="row">
        <div>
          <div class="muted">Orden</div>
          <div class="value">${escapeHtml(order.orderNumber)}</div>
        </div>
        <div>
          <div class="muted">Cuenta</div>
          <div class="value">${escapeHtml(account?.name || 'Sin cuenta')}</div>
        </div>
      </div>

      <div class="block">
        <div class="muted">Destinatario</div>
        <div class="value">${escapeHtml(recipient)}</div>
        ${addressLines.map((line) => `<div style="margin-top:8px;font-size:16px;">${escapeHtml(line)}</div>`).join('')}
      </div>

      <div class="block">
        <div class="muted">Detalle</div>
        <div style="margin-top:8px;font-size:16px;">Fecha: ${escapeHtml(placedAt)}</div>
        <div style="margin-top:8px;" class="total">${escapeHtml(formatCurrency(Number(order.totalAmount), order.currency))}</div>
      </div>

      <div class="block">
        <div class="muted">Productos</div>
        <ul>${itemsHtml || '<li>Sin detalle de productos</li>'}</ul>
      </div>
    </main>
  </body>
</html>`;
}

async function printOfficialShippingLabel(orderId: string) {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const response = await fetch(`${apiBaseUrl}/api/orders/${orderId}/shipping-label`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('No pudimos descargar la etiqueta oficial de Mercado Libre.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, '_blank', 'noopener,noreferrer');

  if (!printWindow) {
    URL.revokeObjectURL(url);
    throw new Error('El navegador bloqueó la ventana de impresión.');
  }

  printWindow.addEventListener(
    'load',
    () => {
      printWindow.print();
      window.setTimeout(() => URL.revokeObjectURL(url), 60 * 1000);
    },
    { once: true },
  );
}

async function openBulkShippingLabelPdf(orderIds: string[]) {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
  const params = new URLSearchParams();
  params.set('orderIds', orderIds.join(','));
  const url = `${apiBaseUrl}/api/orders/shipping-labels/bulk?${params.toString()}`;
  const printWindow = window.open(url, '_blank', 'noopener,noreferrer');

  if (!printWindow) {
    throw new Error('El navegador bloqueó la ventana de impresión.');
  }
}

function buildGroupedOrderRows(
  rows: ApiOrderRow[],
  filter: 'shippingToday' | 'upcoming' | 'inTransit' | 'finalized',
): OrderTableRow[] {
  const groups = new Map<string, ApiOrderRow[]>();
  const getOrderTime = (row: Pick<ApiOrderRow, 'placedAt' | 'importedAt' | 'createdAt'>) => {
    const referenceDate = row.placedAt ?? row.importedAt ?? row.createdAt ?? null;

    if (!referenceDate) {
      return Number.POSITIVE_INFINITY;
    }

    const time = new Date(referenceDate).getTime();
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
  };

  for (const row of rows) {
    const platformKey = row.platform ?? 'unknown';
    const baseGroupKey = row.packId ?? row.id;
    const groupKey = `${platformKey}:${baseGroupKey}`;
    const group = groups.get(groupKey) ?? [];
    group.push(row);
    groups.set(groupKey, group);
  }

  const grouped = Array.from(groups.values()).map((group) => {
    const sortedGroup =
      filter === 'shippingToday'
        ? [...group].sort((left, right) => getOrderTime(right) - getOrderTime(left))
        : group;
    const primaryRow = sortedGroup[0]!;
    const totalAmount = sortedGroup.reduce((sum, row) => sum + Number(row.totalAmount), 0);
    const totalUnits = sortedGroup.reduce((sum, row) => sum + Number(row.totalUnits ?? 0), 0);
    const profitAmount = sortedGroup.reduce<number | null>((sum, row) => {
      if (sum === null || row.profitAmount === null || row.profitAmount === undefined) {
        return null;
      }

      return sum + Number(row.profitAmount);
    }, 0);
    const estimatedNetBeforeCost = sortedGroup.reduce<number | null>((sum, row) => {
      if (
        sum === null ||
        row.estimatedNetBeforeCost === null ||
        row.estimatedNetBeforeCost === undefined
      ) {
        return null;
      }

      return sum + Number(row.estimatedNetBeforeCost);
    }, 0);

    return {
      ...primaryRow,
      totalAmount,
      totalUnits,
      profitAmount,
      estimatedNetBeforeCost,
      shippingDeliveredLate: sortedGroup.some((row) => isDeliveredLateOrder(row)),
      individualOrders: sortedGroup.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        externalOrderId: row.externalOrderId,
        productTitle: row.productTitle,
        productImageUrl: row.productImageUrl,
        totalUnits: Number(row.totalUnits ?? 0),
        shippingType: row.shippingType,
        shippingStatus: row.shippingStatus,
        shippingSubstatus: row.shippingSubstatus,
        shippingSlaStatus: row.shippingSlaStatus,
        shippingExpectedDate: row.shippingExpectedDate,
        shippingDeliveredAt: row.shippingDeliveredAt,
        shippingDeliveredLate: isDeliveredLateOrder(row),
        shippingStage: row.shippingStage ?? null,
        status: row.status,
        totalAmount: Number(row.totalAmount),
      })),
      productCards: sortedGroup.map((row) => ({
        title: row.productTitle,
        imageUrl: row.productImageUrl,
        orderNumber: row.orderNumber,
        shippingType: row.shippingType,
      })),
    };
  });

  if (filter !== 'shippingToday') {
    return grouped;
  }

  return grouped.sort(
    (left, right) => getOrderTime(right) - getOrderTime(left),
  );
}

function attachMessageMeta(
  rows: OrderTableRow[],
  messageMetaByKey: Map<
    string,
    {
      unreadCount: number;
      lastMessageText?: string | null;
      lastMessageCreatedAt?: string | null;
    }
  >,
) {
  return rows.map((row) => {
    const messageMeta =
      messageMetaByKey.get(row.packId ?? '') ??
      messageMetaByKey.get(row.externalOrderId) ??
      null;

    return {
      ...row,
      hasMessages: Boolean(messageMeta),
      unreadMessagesCount: messageMeta?.unreadCount ?? 0,
      lastMessageText: messageMeta?.lastMessageText ?? null,
      lastMessageCreatedAt: messageMeta?.lastMessageCreatedAt ?? null,
      individualOrders: (row.individualOrders ?? []).map((order) => {
        const orderMessageMeta = messageMetaByKey.get(order.externalOrderId) ?? null;

        return {
          ...order,
          hasMessages: Boolean(orderMessageMeta),
          unreadMessagesCount: orderMessageMeta?.unreadCount ?? 0,
        };
      }),
    };
  });
}

function isRowInTransit(row: Pick<OrderTableRow, 'shippingStage' | 'shippingStatus' | 'status' | 'individualOrders'>) {
  const finalizedStages = ['delivered', 'cancelled'];

  if (finalizedStages.includes(row.shippingStage ?? '')) {
    return false;
  }

  if (
    row.shippingStage === 'shipped' ||
    row.shippingStatus === 'shipped' ||
    row.status === 'shipped'
  ) {
    return true;
  }

  return (row.individualOrders ?? []).some(
    (order) =>
      !isFlexRescheduledOrder(order) &&
      !finalizedStages.includes(order.shippingStage ?? '') &&
      (order.shippingStage === 'shipped' ||
        order.shippingStatus === 'shipped' ||
        order.status === 'shipped'),
  );
}

function getFinalizedStageForRow(
  row: Pick<OrderTableRow, 'shippingStage' | 'individualOrders'>,
): FinalizedStage | null {
  const finalStages: FinalizedStage[] = ['delivered', 'cancelled', 'rescheduled'];

  if (row.shippingStage && finalStages.includes(row.shippingStage as FinalizedStage)) {
    return row.shippingStage as FinalizedStage;
  }

  for (const order of row.individualOrders ?? []) {
    if (order.shippingStage && finalStages.includes(order.shippingStage as FinalizedStage)) {
      return order.shippingStage as FinalizedStage;
    }
  }

  return null;
}

function FeedbackToast({
  tone,
  title,
  message,
  details = [],
  onClose,
}: {
  tone: 'success' | 'warning' | 'error';
  title: string;
  message: string;
  details?: string[];
  onClose: () => void;
}) {
  const styles =
    tone === 'success'
      ? 'border-emerald-700 bg-emerald-700 text-white shadow-emerald-950/30'
      : tone === 'warning'
        ? 'border-amber-500 bg-amber-500 text-slate-950 shadow-amber-950/20'
        : 'border-rose-700 bg-rose-700 text-white shadow-rose-950/30';

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[70] w-full max-w-sm">
      <div
        className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${styles}`}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{title}</p>
            <p className="mt-1 text-sm leading-5">{message}</p>
            {details.length > 0 ? (
              <div className="mt-2 space-y-1 text-sm leading-5">
                {details.map((detail) => (
                  <p key={detail}>{detail}</p>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-white/75 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar notificación"
          >
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
              <path
                d="M6 6L14 14M14 6L6 14"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const platformStorageKey = 'orders:selected-platform';
  const allAccountsValue = '__all__';
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<{
    tone: 'success' | 'warning' | 'error';
    title: string;
    message: string;
    details?: string[];
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [accountId, setAccountId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformCode | ''>('');
  const [shippingTypeFilter, setShippingTypeFilter] = useState<ShippingTypeFilter>('all');
  const [isPlatformMenuOpen, setIsPlatformMenuOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isShippingTypeMenuOpen, setIsShippingTypeMenuOpen] = useState(false);
  const platformMenuRef = useRef<HTMLDivElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const shippingTypeMenuRef = useRef<HTMLDivElement | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [selectedTotalsMode, setSelectedTotalsMode] = useState<'gross' | 'estimated'>('gross');
  const [filter, setFilter] = useState<
    'shippingToday' | 'upcoming' | 'inTransit' | 'finalized'
  >('shippingToday');
  const [shippingStageFilter, setShippingStageFilter] = useState<ShippingStageFilter>('all');
  const [upcomingStageFilter, setUpcomingStageFilter] = useState<UpcomingStageFilter>('all');
  const [inTransitStageFilter, setInTransitStageFilter] = useState<InTransitStageFilter>('all');
  const [finalizedStageFilter, setFinalizedStageFilter] = useState<FinalizedStageFilter>('all');
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderTableRow | null>(null);
  const [pendingCancelOrder, setPendingCancelOrder] = useState<OrderTableRow | null>(null);
  const [cancelReason, setCancelReason] = useState<(typeof CANCEL_REASON_OPTIONS)[number] | ''>('');
  const [selectedOrderTab, setSelectedOrderTab] = useState<OrderDetailTab>('products');
  const [shippingTodayDate, setShippingTodayDate] = useState(() => getLocalDateKey());
  const [isBulkPrinting, setIsBulkPrinting] = useState(false);
  const selectedOrderCount = selectedOrder?.individualOrders?.length ?? 1;
  const isGroupedSelectedOrder = selectedOrderCount > 1;
  const selectedOrderCancellableIds = selectedOrder ? getCancellableOrderIds(selectedOrder) : [];
  const selectedOrderPreviewImages = Array.from(
    new Set(
      [
        selectedOrder?.productImageUrl,
        ...(selectedOrder?.individualOrders ?? []).map((order) => order.productImageUrl),
      ]
        .map((url) => normalizeImageUrl(url))
        .filter((url): url is string => Boolean(url)),
    ),
  );
  const hasStackedSelectedOrderImages = selectedOrderPreviewImages.length > 1;
  const selectedOrderStatusMeta = selectedOrder ? getModalStatusMeta(selectedOrder) : null;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextDate = getLocalDateKey();
      setShippingTodayDate((currentDate) => (currentDate === nextDate ? currentDate : nextDate));
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!syncFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSyncFeedback(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [syncFeedback]);

  useEffect(() => {
    if (!isPlatformMenuOpen && !isAccountMenuOpen && !isShippingTypeMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;

      if (
        platformMenuRef.current &&
        target &&
        !platformMenuRef.current.contains(target)
      ) {
        setIsPlatformMenuOpen(false);
      }

      if (
        accountMenuRef.current &&
        target &&
        !accountMenuRef.current.contains(target)
      ) {
        setIsAccountMenuOpen(false);
      }

      if (
        shippingTypeMenuRef.current &&
        target &&
        !shippingTypeMenuRef.current.contains(target)
      ) {
        setIsShippingTypeMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isAccountMenuOpen, isPlatformMenuOpen, isShippingTypeMenuOpen]);

  useEffect(() => {
    if (!openActionMenuId) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;

      if (target?.closest('[data-order-actions-menu="true"]')) {
        return;
      }

      setOpenActionMenuId(null);
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openActionMenuId]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['orders-accounts-options'],
    queryFn: () => fetchApi<ApiAccount[]>('/accounts'),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: orderMessages } = useQuery({
    queryKey: ['orders-messages-meta'],
    queryFn: () => fetchApi<OrderMessagesResponse>('/messages'),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const messageMetaByKey = useMemo(() => {
    const entries = new Map<
      string,
      {
        unreadCount: number;
        lastMessageText?: string | null;
        lastMessageCreatedAt?: string | null;
      }
    >();

    for (const conversation of orderMessages?.data ?? []) {
      const keys = [conversation.packId, conversation.orderId].filter(
        (value): value is string => Boolean(value),
      );

      for (const key of keys) {
        const current = entries.get(key) ?? {
          unreadCount: 0,
          lastMessageText: null,
          lastMessageCreatedAt: null,
        };

        entries.set(key, {
          unreadCount: current.unreadCount + conversation.unreadCount,
          lastMessageText: conversation.lastMessage?.text ?? current.lastMessageText,
          lastMessageCreatedAt:
            conversation.lastMessage?.createdAt ?? current.lastMessageCreatedAt,
        });
      }
    }

    return entries;
  }, [orderMessages?.data]);

  const messageConversationByKey = useMemo(() => {
    const entries = new Map<
      string,
      {
        conversationId?: string;
        accountId?: string;
        resource?: string | null;
      }
    >();

    for (const conversation of orderMessages?.data ?? []) {
      const keys = [conversation.packId, conversation.orderId].filter(
        (value): value is string => Boolean(value),
      );

      for (const key of keys) {
        if (entries.has(key)) {
          continue;
        }

        entries.set(key, {
          conversationId: conversation.id,
          accountId: conversation.accountId,
          resource: conversation.resource ?? null,
        });
      }
    }

    return entries;
  }, [orderMessages?.data]);

  const accountPlatformById = useMemo(() => {
    return new Map(
      accounts.map((account) => [
        account.id,
        account.platform ?? account.channel?.code ?? 'mercadolibre',
      ]),
    );
  }, [accounts]);

  const accountNameById = useMemo(() => {
    return new Map(accounts.map((account) => [account.id, account.name]));
  }, [accounts]);

  const platformOptions = useMemo<PlatformOption[]>(() => {
    const usedPlatforms = Array.from(
      new Set(
        accounts
          .map((account) => account.platform ?? account.channel?.code)
          .filter((platform): platform is PlatformCode => Boolean(platform)),
      ),
    );

    return usedPlatforms.map((platform) => ({
      value: platform,
      label: formatPlatformLabel(platform),
    }));
  }, [accounts]);

  const allOrdersQuery = useQuery({
    queryKey: getOrdersDatasetQueryKey('all', shippingTodayDate, selectedAccountId, selectedPlatform),
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: filter === 'upcoming' ? 30 * 1000 : false,
    refetchIntervalInBackground: false,
    queryFn: () => fetchOrdersDataset('all', shippingTodayDate, selectedAccountId, selectedPlatform),
  });

  const shippingTodayOrdersQuery = useQuery({
    queryKey: getOrdersDatasetQueryKey(
      'shippingToday',
      shippingTodayDate,
      selectedAccountId,
      selectedPlatform,
    ),
    staleTime: 30 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: filter === 'shippingToday' ? 30 * 1000 : false,
    refetchIntervalInBackground: false,
    queryFn: () =>
      fetchOrdersDataset('shippingToday', shippingTodayDate, selectedAccountId, selectedPlatform),
  });

  const inTransitOrdersQuery = useQuery({
    queryKey: getOrdersDatasetQueryKey(
      'inTransit',
      shippingTodayDate,
      selectedAccountId,
      selectedPlatform,
    ),
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: filter === 'inTransit' ? 30 * 1000 : false,
    refetchIntervalInBackground: false,
    queryFn: () =>
      fetchOrdersDataset('inTransit', shippingTodayDate, selectedAccountId, selectedPlatform),
  });

  const finalizedOrdersQuery = useQuery({
    queryKey: getOrdersDatasetQueryKey(
      'finalized',
      shippingTodayDate,
      selectedAccountId,
      selectedPlatform,
    ),
    staleTime: 2 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: filter === 'finalized' ? 30 * 1000 : false,
    refetchIntervalInBackground: false,
    queryFn: () =>
      fetchOrdersDataset('finalized', shippingTodayDate, selectedAccountId, selectedPlatform),
  });

  const {
    data: selectedOrderDetail,
    isLoading: isLoadingSelectedOrder,
    isError: isSelectedOrderError,
  } = useQuery({
    queryKey: ['order-detail', selectedOrder?.id],
    enabled: Boolean(selectedOrder?.id),
    queryFn: () => fetchApi<OrderDetailResponse>(`/orders/${selectedOrder!.id}`),
  });

  useEffect(() => {
    if (selectedOrder) {
      setSelectedOrderTab('products');
    }
  }, [selectedOrder]);

  function renderOrderSidebar() {
    return (
      <section className="h-full rounded-[1.7rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="flex h-full flex-col">
          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
            Acciones
          </p>
          <div className="mt-3 flex flex-1 flex-col gap-3">
            <button
              type="button"
              onClick={() => selectedOrder && void handlePrintLabel(selectedOrder)}
              disabled={!selectedOrder || printingOrderId === selectedOrder.id}
              className="inline-flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-night transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="inline-flex items-center gap-2">
                <Printer className="h-4 w-4 text-ink/55" />
                <span>Imprimir etiqueta</span>
              </span>
              <span className="text-xs font-medium text-ink/45">
                {selectedOrder && printingOrderId === selectedOrder.id ? 'Preparando' : 'Acción'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => selectedOrder && handleOpenMessages(selectedOrder)}
              disabled={!selectedOrder}
              className="inline-flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-night transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="inline-flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-ink/55" />
                <span>{selectedOrder?.hasMessages ? 'Ver mensaje' : 'Enviar mensaje'}</span>
              </span>
              <span className="text-xs font-medium text-ink/45">
                {selectedOrder?.hasMessages ? 'Bandeja' : 'Ir'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => selectedOrder && void handleCancelOrder(selectedOrder)}
              disabled={!selectedOrder || cancelOrdersMutation.isPending || selectedOrderCancellableIds.length === 0}
              className="inline-flex w-full items-center justify-between rounded-2xl border border-rose-300/80 bg-rose-50/80 px-4 py-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>Cancelar orden</span>
              <span className="text-xs font-medium text-rose-500">
                {cancelOrdersMutation.isPending && selectedOrder && cancellingOrderId === selectedOrder.id
                  ? 'Procesando'
                  : 'Acción'}
              </span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const data =
    filter === 'shippingToday'
      ? shippingTodayOrdersQuery.data
      : filter === 'upcoming'
        ? allOrdersQuery.data
        : filter === 'inTransit'
          ? inTransitOrdersQuery.data
          : finalizedOrdersQuery.data;
  const isLoading =
    filter === 'shippingToday'
      ? shippingTodayOrdersQuery.isLoading
      : filter === 'upcoming'
        ? allOrdersQuery.isLoading
        : filter === 'inTransit'
          ? inTransitOrdersQuery.isLoading
          : finalizedOrdersQuery.isLoading;
  const isError =
    filter === 'shippingToday'
      ? shippingTodayOrdersQuery.isError
      : filter === 'upcoming'
        ? allOrdersQuery.isError
        : filter === 'inTransit'
          ? inTransitOrdersQuery.isError
          : finalizedOrdersQuery.isError;
  const isFetching =
    filter === 'shippingToday'
      ? shippingTodayOrdersQuery.isFetching
      : filter === 'upcoming'
        ? allOrdersQuery.isFetching
        : filter === 'inTransit'
          ? inTransitOrdersQuery.isFetching
          : finalizedOrdersQuery.isFetching;

  const rows = data?.rows ?? [];
  const visibleRows = useMemo(() => rows, [rows]);
  const groupedRows = useMemo<OrderTableRow[]>(() => {
    return attachMessageMeta(buildGroupedOrderRows(visibleRows, filter), messageMetaByKey);
  }, [filter, messageMetaByKey, visibleRows]);
  const allOrdersData = useMemo(() => {
    if (!allOrdersQuery.data) {
      return undefined;
    }

    return {
      ...allOrdersQuery.data,
      rows: allOrdersQuery.data.rows,
    };
  }, [allOrdersQuery.data]);
  const shippingTodayOrdersData = useMemo(() => {
    if (!shippingTodayOrdersQuery.data) {
      return undefined;
    }

    return {
      ...shippingTodayOrdersQuery.data,
      rows: shippingTodayOrdersQuery.data.rows,
    };
  }, [shippingTodayOrdersQuery.data]);
  const inTransitOrdersData = useMemo(() => {
    if (!inTransitOrdersQuery.data) {
      return undefined;
    }

    return {
      ...inTransitOrdersQuery.data,
      rows: inTransitOrdersQuery.data.rows,
    };
  }, [inTransitOrdersQuery.data]);
  const finalizedOrdersData = useMemo(() => {
    if (!finalizedOrdersQuery.data) {
      return undefined;
    }

    return {
      ...finalizedOrdersQuery.data,
      rows: finalizedOrdersQuery.data.rows,
    };
  }, [finalizedOrdersQuery.data]);
  const finalizedGroupedRows = useMemo(
    () =>
      attachMessageMeta(
        buildGroupedOrderRows(finalizedOrdersData?.rows ?? [], 'finalized'),
        messageMetaByKey,
      ),
    [finalizedOrdersData?.rows, messageMetaByKey],
  );

  const inTransitCount =
    inTransitOrdersData?.rows?.filter((order) =>
      isRowInTransit({
        shippingStage: order.shippingStage ?? null,
        shippingStatus: order.shippingStatus ?? null,
        status: order.status,
        individualOrders: [
          {
            id: order.id,
            orderNumber: order.orderNumber,
            externalOrderId: order.externalOrderId,
            shippingStatus: order.shippingStatus,
            shippingStage: order.shippingStage ?? null,
            status: order.status,
            totalAmount: Number(order.totalAmount),
          },
        ],
      }),
    ).length ?? 0;
  const finalizedCount = finalizedGroupedRows.filter((row) => getFinalizedStageForRow(row)).length;
  const finalizedStageCounts = useMemo(
    () => ({
      delivered: finalizedGroupedRows.filter((row) => getFinalizedStageForRow(row) === 'delivered')
        .length,
      cancelled: finalizedGroupedRows.filter((row) => getFinalizedStageForRow(row) === 'cancelled')
        .length,
      rescheduled: finalizedGroupedRows.filter((row) => getFinalizedStageForRow(row) === 'rescheduled')
        .length,
    }),
    [finalizedGroupedRows],
  );

  const getShippingExpectedDateKey = (value?: string | null) => {
    if (!value) {
      return null;
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return getLocalDateKey(parsedDate);
  };

  const upcomingRows = useMemo(() => {
    const sourceRows =
      filter === 'upcoming'
        ? groupedRows
        : attachMessageMeta(
            buildGroupedOrderRows(allOrdersData?.rows ?? [], 'upcoming'),
            messageMetaByKey,
          );

    return sourceRows.filter((row) => {
      if (isRowInTransit(row)) {
        return false;
      }

      const relevantOrders = (row.individualOrders ?? []).filter((order) =>
        ['ready_to_print', 'ready_to_ship'].includes(order.shippingStage ?? ''),
      );

      if (relevantOrders.length === 0) {
        return false;
      }

      return relevantOrders.some((order) => {
        const expectedDateKey = getShippingExpectedDateKey(order.shippingExpectedDate);
        return expectedDateKey !== null && expectedDateKey > shippingTodayDate;
      });
    });
  }, [allOrdersData?.rows, filter, groupedRows, shippingTodayDate]);
  const upcomingGroupKeys = useMemo(
    () => new Set(upcomingRows.map((row) => row.packId ?? row.externalOrderId).filter(Boolean)),
    [upcomingRows],
  );
  const upcomingCount = upcomingRows.length;
  const upcomingStageCounts = useMemo(
    () => ({
      ready_to_print: upcomingRows.filter((row) =>
        (row.individualOrders ?? []).some((order) => order.shippingStage === 'ready_to_print'),
      ).length,
      ready_to_ship: upcomingRows.filter((row) =>
        (row.individualOrders ?? []).some((order) => order.shippingStage === 'ready_to_ship'),
      ).length,
    }),
    [upcomingRows],
  );

  const shippingTodayGroupedRows = useMemo(() => {
    return filter === 'shippingToday'
      ? groupedRows
      : attachMessageMeta(
          buildGroupedOrderRows(shippingTodayOrdersData?.rows ?? [], 'shippingToday'),
          messageMetaByKey,
        );
  }, [filter, groupedRows, messageMetaByKey, shippingTodayOrdersData?.rows]);

  const shippingTodayGroupKeys = useMemo(() => {
    return new Set(
      shippingTodayGroupedRows.map((row) => row.packId ?? row.externalOrderId).filter(Boolean),
    );
  }, [shippingTodayGroupedRows]);

  const overdueShippingRows = useMemo(() => {
    const sourceRows =
      filter === 'inTransit'
        ? groupedRows
        : attachMessageMeta(
            buildGroupedOrderRows(inTransitOrdersData?.rows ?? [], 'inTransit'),
            messageMetaByKey,
          );

      return sourceRows
      .filter((row) =>
        (row.individualOrders ?? []).some(
          (order) => order.shippingType === 'flex' && isRowInTransit(row),
        ),
      )
      .map((row) => {
        const rowKey = row.packId ?? row.externalOrderId;
        const hasDelayedFlexInTransit = (row.individualOrders ?? []).some(
          (order) =>
            order.shippingType === 'flex' &&
            isRowInTransit(row) &&
            (() => {
              const slaStatus = order.shippingSlaStatus?.toLowerCase() ?? '';
              const expectedDateKey = getShippingExpectedDateKey(order.shippingExpectedDate);

              return (
                !isFlexRescheduledOrder(order) &&
                (
                  ['delayed', 'late', 'out_of_time'].includes(slaStatus) ||
                  (expectedDateKey !== null && expectedDateKey < shippingTodayDate)
                )
              );
            })(),
        );

        return {
          ...row,
          shippingOverdue: hasDelayedFlexInTransit,
        };
      })
      .filter((row) => row.shippingOverdue);
  }, [filter, groupedRows, inTransitOrdersData?.rows, messageMetaByKey, shippingTodayGroupKeys]);

  const inTransitRows = useMemo(() => {
    const sourceRows =
      filter === 'inTransit'
        ? groupedRows
        : attachMessageMeta(
            buildGroupedOrderRows(inTransitOrdersData?.rows ?? [], 'inTransit'),
            messageMetaByKey,
          );

    return sourceRows
      .filter((row) =>
        isRowInTransit(row),
      )
      .map((row) => {
        const hasFlexInTransit = (row.individualOrders ?? []).some(
          (order) => order.shippingType === 'flex' && isRowInTransit(row),
        );

        return {
          ...row,
          shippingOverdue: hasFlexInTransit
            ? (row.individualOrders ?? []).some(
                (order) =>
                  order.shippingType === 'flex' &&
                  isRowInTransit(row) &&
                  (() => {
                    const slaStatus = order.shippingSlaStatus?.toLowerCase() ?? '';
                    const expectedDateKey = getShippingExpectedDateKey(order.shippingExpectedDate);

                    return (
                      !isFlexRescheduledOrder(order) &&
                      (
                        ['delayed', 'late', 'out_of_time'].includes(slaStatus) ||
                        (expectedDateKey !== null && expectedDateKey < shippingTodayDate)
                      )
                    );
                  })(),
              )
            : false,
        };
      });
  }, [filter, groupedRows, inTransitOrdersData?.rows, messageMetaByKey, shippingTodayDate]);

  const inTransitRescheduledRows = useMemo(() => {
    const sourceRows =
      filter === 'inTransit'
        ? groupedRows
        : attachMessageMeta(
            buildGroupedOrderRows(inTransitOrdersData?.rows ?? [], 'inTransit'),
            messageMetaByKey,
          );

    return sourceRows.filter((row) =>
      (row.individualOrders ?? []).some((order) => order.shippingStage === 'rescheduled'),
    );
  }, [filter, groupedRows, inTransitOrdersData?.rows, messageMetaByKey]);

  const inTransitStageCounts = useMemo(
    () => ({
      shipped: inTransitRows.filter(
        (row) =>
          isRowInTransit(row) &&
          !row.shippingOverdue &&
          !(row.individualOrders ?? []).some((order) => order.shippingStage === 'rescheduled'),
      ).length,
      overdue: inTransitRows.filter((row) => row.shippingOverdue).length,
      rescheduled: inTransitRescheduledRows.length,
    }),
    [inTransitRescheduledRows, inTransitRows],
  );

  const deliveredLateRows = useMemo(() => {
    return shippingTodayGroupedRows
      .map((row) => ({
        ...row,
        shippingDeliveredLate:
          row.shippingDeliveredLate ??
          (row.individualOrders ?? []).some((order) => Boolean(order.shippingDeliveredLate)),
      }))
      .filter(
        (row) =>
          row.shippingDeliveredLate &&
          (row.individualOrders ?? []).some(
            (order) => getDateKeyFromValue(order.shippingDeliveredAt) === shippingTodayDate,
          ),
      );
  }, [shippingTodayDate, shippingTodayGroupedRows]);

  const overdueStageRows = useMemo(() => {
    const rowsByKey = new Map<string, (typeof shippingTodayGroupedRows)[number]>();

    for (const row of overdueShippingRows) {
      rowsByKey.set(row.packId ?? row.externalOrderId ?? row.id, row);
    }

    for (const row of deliveredLateRows) {
      rowsByKey.set(row.packId ?? row.externalOrderId ?? row.id, row);
    }

    return Array.from(rowsByKey.values());
  }, [deliveredLateRows, overdueShippingRows]);

  const shippingTodayAllRows = useMemo(() => {
    const rowsByKey = new Map<string, (typeof shippingTodayGroupedRows)[number]>();

    for (const row of shippingTodayGroupedRows) {
      const rowKey = row.packId ?? row.externalOrderId;
      if (rowKey && !upcomingGroupKeys.has(rowKey)) {
        rowsByKey.set(rowKey, row);
      }
    }

    const currentRows = Array.from(rowsByKey.values()).filter((row) => {
      const shippedOrders = (row.individualOrders ?? []).filter(
        (order) =>
          !isFlexRescheduledOrder(order) &&
          (
            order.shippingStage === 'shipped' ||
            order.shippingStatus === 'shipped' ||
            order.status === 'shipped'
          ),
      );

      if (shippedOrders.length === 0) {
        return true;
      }

      return shippedOrders.some((order) => {
        const expectedDateKey = getShippingExpectedDateKey(order.shippingExpectedDate);
        return expectedDateKey === null || expectedDateKey >= shippingTodayDate;
      });
    });

    const mergedRows = new Map(
      currentRows.map((row) => [row.packId ?? row.externalOrderId ?? row.id, row]),
    );

    for (const row of overdueShippingRows) {
      const rowKey = row.packId ?? row.externalOrderId ?? row.id;
      if (rowKey) {
        mergedRows.set(rowKey, row);
      }
    }

    for (const row of deliveredLateRows) {
      const rowKey = row.packId ?? row.externalOrderId ?? row.id;
      if (rowKey) {
        mergedRows.set(rowKey, row);
      }
    }

    return Array.from(mergedRows.values());
  }, [deliveredLateRows, overdueShippingRows, shippingTodayDate, shippingTodayGroupedRows, upcomingGroupKeys]);

  const shippingTodayCount = shippingTodayAllRows.length;

  const filteredGroupedRows = useMemo(() => {
    if (filter === 'inTransit') {
      if (inTransitStageFilter === 'all') {
        return inTransitRows.filter((row) => matchesShippingTypeFilter(row, shippingTypeFilter));
      }

      if (inTransitStageFilter === 'overdue') {
        return inTransitRows.filter(
          (row) => row.shippingOverdue && matchesShippingTypeFilter(row, shippingTypeFilter),
        );
      }

      if (inTransitStageFilter === 'rescheduled') {
        return inTransitRescheduledRows.filter((row) =>
          matchesShippingTypeFilter(row, shippingTypeFilter),
        );
      }

      return inTransitRows.filter(
        (row) =>
          matchesShippingTypeFilter(row, shippingTypeFilter) &&
          !row.shippingOverdue &&
          isRowInTransit(row) &&
          !(row.individualOrders ?? []).some((order) => order.shippingStage === 'rescheduled'),
      );
    }

    if (filter === 'finalized') {
      if (finalizedStageFilter === 'all') {
        return groupedRows.filter(
          (row) =>
            getFinalizedStageForRow(row) !== null &&
            matchesShippingTypeFilter(row, shippingTypeFilter),
        );
      }

      return groupedRows.filter(
        (row) =>
          getFinalizedStageForRow(row) === finalizedStageFilter &&
          matchesShippingTypeFilter(row, shippingTypeFilter),
      );
    }

    if (filter === 'upcoming') {
      if (upcomingStageFilter === 'all') {
        return upcomingRows.filter((row) => matchesShippingTypeFilter(row, shippingTypeFilter));
      }

      return upcomingRows.filter((row) =>
        matchesShippingTypeFilter(row, shippingTypeFilter) &&
        (row.individualOrders ?? []).some((order) => order.shippingStage === upcomingStageFilter),
      );
    }

    if (filter === 'shippingToday' && shippingStageFilter === 'overdue') {
      return overdueStageRows.filter((row) => matchesShippingTypeFilter(row, shippingTypeFilter));
    }

    if (filter !== 'shippingToday' || shippingStageFilter === 'all') {
      const baseRows = filter === 'shippingToday' ? shippingTodayAllRows : groupedRows;
      return baseRows.filter((row) => matchesShippingTypeFilter(row, shippingTypeFilter));
    }

    return shippingTodayAllRows.filter((row) => {
      if (shippingStageFilter === 'shipped') {
        return (
          matchesShippingTypeFilter(row, shippingTypeFilter) &&
          !row.shippingOverdue &&
          isRowInTransit(row)
        );
      }

      if (shippingStageFilter === 'delivered') {
        return (
          matchesShippingTypeFilter(row, shippingTypeFilter) &&
          (row.individualOrders ?? []).some((order) => order.shippingStage === 'delivered')
        );
      }

      if (shippingStageFilter === 'cancelled') {
        return (
          matchesShippingTypeFilter(row, shippingTypeFilter) &&
          (row.individualOrders ?? []).some((order) => order.shippingStage === 'cancelled')
        );
      }

      return (
        matchesShippingTypeFilter(row, shippingTypeFilter) &&
        (row.individualOrders ?? []).some(
          (order) => order.shippingStage === shippingStageFilter,
        )
      );
    });
  }, [filter, finalizedStageFilter, groupedRows, inTransitRescheduledRows, inTransitRows, inTransitStageFilter, overdueStageRows, shippingStageFilter, shippingTodayAllRows, shippingTodayGroupKeys, overdueShippingRows, shippingTypeFilter, upcomingRows, upcomingStageFilter]);

  const shippingStageCounts = useMemo(() => {
    const countByStage = {
      ready_to_print: 0,
      ready_to_ship: 0,
      shipped: 0,
      overdue: overdueStageRows.length,
      rescheduled: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const row of shippingTodayAllRows) {
      const stages = new Set(
        (row.individualOrders ?? []).map((order) => order.shippingStage).filter(Boolean),
      );

      if (stages.has('ready_to_print')) {
        countByStage.ready_to_print += 1;
      }

      if (stages.has('ready_to_ship')) {
        countByStage.ready_to_ship += 1;
      }

      if (stages.has('shipped') && !row.shippingOverdue) {
        countByStage.shipped += 1;
      }

      if (stages.has('rescheduled')) {
        countByStage.rescheduled += 1;
      }

      if (stages.has('delivered')) {
        countByStage.delivered += 1;
      }

      if (stages.has('cancelled')) {
        countByStage.cancelled += 1;
      }
    }

    return countByStage;
  }, [overdueStageRows.length, shippingTodayAllRows]);

  const manualSyncOrders = useMutation({
    mutationFn: async (currentAccountId: string) => {
      setError(null);
      setSyncFeedback(null);
      const suffix =
        currentAccountId && currentAccountId !== allAccountsValue
          ? `?accountId=${currentAccountId}`
          : '';

      return postApi<RefreshLiveOrdersResponse>(`/orders/refresh-live${suffix}`);
    },
    onSuccess: async (result, currentAccountId) => {
      setIsOpen(false);
      const accountScopeLabel =
        currentAccountId === allAccountsValue
          ? `todas las cuentas (${result.accountsProcessed})`
          : 'la cuenta seleccionada';
      const hasErrors = result.errors.length > 0;
      const errorAccountDetails = result.errors.map(({ accountId: failedAccountId, message }) => {
        const accountName =
          failedAccountId === currentAccountId && currentAccountId !== allAccountsValue
            ? accounts.find((account) => account.id === currentAccountId)?.name
            : accountNameById.get(failedAccountId);

        return accountName ? `${accountName}: ${message}` : `${failedAccountId}: ${message}`;
      });

      setSyncFeedback({
        tone: hasErrors ? 'warning' : 'success',
        title: hasErrors ? 'Sincronización completada con advertencias' : 'Sincronización completada',
        message: hasErrors
          ? `La sincronización de ${accountScopeLabel} terminó con ${result.errors.length} cuenta(s) con problema. Se importaron ${result.importedCount} órdenes nuevas y se actualizaron ${result.refreshedOpenOrders} órdenes abiertas.`
          : result.importedCount > 0
            ? `Sincronizamos ${accountScopeLabel}: ${result.importedCount} órdenes nuevas importadas, ${result.skippedCount} ya registradas y ${result.refreshedOpenOrders} órdenes abiertas actualizadas.`
            : `Sincronizamos ${accountScopeLabel}: no encontramos órdenes nuevas, y se actualizaron ${result.refreshedOpenOrders} órdenes abiertas.`,
        details: hasErrors ? errorAccountDetails : [],
      });
      await queryClient.invalidateQueries({ queryKey: ['orders-page'] });
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof ApiError
          ? mutationError.message
          : 'No pudimos sincronizar las órdenes.';
      setError(message);
      setSyncFeedback({
        tone: 'error',
        title: 'Error al sincronizar',
        message,
      });
    },
  });

  const refreshLiveOrders = useMutation({
    mutationFn: async (currentAccountId?: string) => {
      const suffix = currentAccountId ? `?accountId=${currentAccountId}` : '';
      await postApi(`/orders/refresh-live${suffix}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders-page'] });
    },
  });

  const cancelOrdersMutation = useMutation({
    mutationFn: async ({ row, orderIds }: { row: OrderTableRow; orderIds: string[] }) => {
      for (const orderId of orderIds) {
        await postApi(`/orders/${orderId}/cancel`);
      }

      return {
        row,
        orderIds,
      };
    },
    onMutate: ({ row }) => {
      setActionError(null);
      setCancellingOrderId(row.id);
    },
    onSuccess: async ({ row, orderIds }) => {
      const cancelledOrderIds = new Set(orderIds);
      setPendingCancelOrder(null);
      setCancelReason('');

      setSelectedOrder((current) => {
        if (!current) {
          return current;
        }

        const nextIndividualOrders = (current.individualOrders ?? []).map((order) =>
          cancelledOrderIds.has(order.id)
            ? {
                ...order,
                status: 'canceled',
                shippingStatus: 'cancelled',
                shippingStage: 'cancelled' as const,
              }
            : order,
        );

        const primaryCancelled = cancelledOrderIds.has(current.id);

        return {
          ...current,
          status: primaryCancelled ? 'canceled' : current.status,
          shippingStatus: primaryCancelled ? 'cancelled' : current.shippingStatus,
          shippingStage: primaryCancelled ? ('cancelled' as const) : current.shippingStage,
          individualOrders: nextIndividualOrders,
        };
      });

      setOpenActionMenuId(null);
      setSyncFeedback({
        tone: 'success',
        title: orderIds.length > 1 ? 'Órdenes canceladas' : 'Orden cancelada',
        message:
          orderIds.length > 1
            ? `Cancelamos ${orderIds.length} órdenes de ${row.packId ? `Pack ${row.packId}` : row.orderNumber}.`
            : `Cancelamos ${row.packId ? `Pack ${row.packId}` : row.orderNumber}.`,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['orders-page'] }),
        selectedOrder?.id
          ? queryClient.invalidateQueries({ queryKey: ['order-detail', selectedOrder.id] })
          : Promise.resolve(),
      ]);
    },
    onError: (mutationError) => {
      setActionError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'No pudimos cancelar la orden.',
      );
    },
    onSettled: () => {
      setCancellingOrderId(null);
    },
  });

  async function handleCancelOrder(row: OrderTableRow) {
    const orderIds = getCancellableOrderIds(row);

    if (orderIds.length === 0 || cancelOrdersMutation.isPending) {
      return;
    }
    setPendingCancelOrder(row);
    setCancelReason('');
  }

  function confirmCancelOrder() {
    if (!pendingCancelOrder || !cancelReason || cancelOrdersMutation.isPending) {
      return;
    }

    const orderIds = getCancellableOrderIds(pendingCancelOrder);
    if (orderIds.length === 0) {
      return;
    }

    cancelOrdersMutation.mutate({ row: pendingCancelOrder, orderIds });
  }

  async function handlePrintLabel(row: OrderTableRow) {
    try {
      setActionError(null);
      setPrintingOrderId(row.id);

      const printableOrderIds = (row.individualOrders ?? [])
        .filter((order) => canPrintShippingLabel(order))
        .map((order) => order.id);

      if (printableOrderIds.length > 1) {
        await openBulkShippingLabelPdf(printableOrderIds);
        return;
      }

      try {
        await printOfficialShippingLabel(row.id);
      } catch {
        const detail = await fetchApi<OrderDetailResponse>(`/orders/${row.id}`);
        const printWindow = window.open(
          '',
          '_blank',
          'noopener,noreferrer,width=900,height=900',
        );

        if (!printWindow) {
          throw new Error('El navegador bloqueó la ventana de impresión.');
        }

        printWindow.document.open();
        printWindow.document.write(buildPrintLabelHtml(detail));
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }
    } catch (printError) {
      setActionError(
        printError instanceof Error
          ? printError.message
          : 'No pudimos preparar la etiqueta para impresión.',
      );
    } finally {
      setPrintingOrderId(null);
    }
  }

  function handleOpenMessages(row: OrderTableRow) {
    const keys = [row.packId, row.orderNumber].filter((value): value is string => Boolean(value));
    const match = keys
      .map((key) => messageConversationByKey.get(key))
      .find((value) => Boolean(value?.conversationId));

    if (match?.conversationId) {
      window.location.assign(`/messages?conversationId=${encodeURIComponent(match.conversationId)}`);
      return;
    }

    window.location.assign('/messages');
  }

  useEffect(() => {
    if (!allOrdersData) {
      return;
    }

    const runRefresh = () => {
      if (refreshLiveOrders.isPending) {
        return;
      }

      refreshLiveOrders.mutate(selectedAccountId || undefined);
    };

    runRefresh();

    const intervalId = window.setInterval(runRefresh, 30 * 1000);
    return () => window.clearInterval(intervalId);
  }, [allOrdersData, refreshLiveOrders, selectedAccountId, shippingTodayDate]);

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((account) => {
          if (account.status !== 'active') {
            return false;
          }

          if (!selectedPlatform) {
            return true;
          }

          return (account.platform ?? account.channel?.code ?? 'mercadolibre') === selectedPlatform;
        })
        .map((account) => ({ value: account.id, label: account.name })),
    [accounts, selectedPlatform],
  );
  const hasSinglePlatformOption = platformOptions.length === 1;
  const selectedPlatformLabel = selectedPlatform
    ? platformOptions.find((option) => option.value === selectedPlatform)?.label ??
      formatPlatformLabel(selectedPlatform)
    : 'Todas las plataformas';
  const selectedAccountLabel = selectedAccountId
    ? accountOptions.find((option) => option.value === selectedAccountId)?.label ?? 'Cuenta'
    : 'Todas las cuentas';
  const hasSingleAccountOption = accountOptions.length === 1;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedPlatform = window.localStorage.getItem(platformStorageKey) as PlatformCode | '' | null;
    const availablePlatforms = new Set(platformOptions.map((option) => option.value));

    if (platformOptions.length === 0) {
      setSelectedPlatform('');
      return;
    }

    if (platformOptions.length === 1) {
      const onlyPlatform = platformOptions[0]!.value;
      setSelectedPlatform((current) => (current === onlyPlatform ? current : onlyPlatform));
      return;
    }

    setSelectedPlatform((current) => {
      if (current && availablePlatforms.has(current)) {
        return current;
      }

      if (storedPlatform && availablePlatforms.has(storedPlatform)) {
        return storedPlatform;
      }

      return platformOptions[0]!.value;
    });
  }, [platformOptions]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!selectedPlatform) {
      window.localStorage.removeItem(platformStorageKey);
      return;
    }

    window.localStorage.setItem(platformStorageKey, selectedPlatform);
  }, [platformStorageKey, selectedPlatform]);

  useEffect(() => {
    if (accountOptions.length === 1) {
      const onlyAccount = accountOptions[0]!.value;
      setSelectedAccountId((current) => (current === onlyAccount ? current : onlyAccount));
      return;
    }

    if (!selectedAccountId) {
      return;
    }

    const selectedAccountStillVisible = accountOptions.some(
      (account) => account.value === selectedAccountId,
    );

    if (!selectedAccountStillVisible) {
      setSelectedAccountId('');
    }
  }, [accountOptions, selectedAccountId]);

  const readyToPrintOrderIds = useMemo(() => {
    const shouldShowReadyToPrintBulkAction =
      (filter === 'shippingToday' &&
        (shippingStageFilter === 'ready_to_print' || shippingStageFilter === 'ready_to_ship')) ||
      filter === 'upcoming';

    if (!shouldShowReadyToPrintBulkAction) {
      return [];
    }

    return Array.from(
      new Set(
        filteredGroupedRows.flatMap((row) => {
          const printableOrderIds = (row.individualOrders ?? [])
            .filter((order) => canPrintShippingLabel(order))
            .map((order) => order.id);

          if (printableOrderIds.length > 0) {
            return printableOrderIds;
          }

          return canPrintShippingLabel(row) ? [row.id] : [];
        }),
      ),
    );
  }, [filter, filteredGroupedRows, shippingStageFilter]);

  const selectableRowIds = useMemo(() => {
    return new Set(
      filteredGroupedRows
        .filter((row) => {
          const printableOrderIds = (row.individualOrders ?? [])
            .filter((order) => canPrintShippingLabel(order))
            .map((order) => order.id);

          return printableOrderIds.length > 0 || canPrintShippingLabel(row);
        })
        .map((row) => row.id),
    );
  }, [filteredGroupedRows]);

  const selectedPrintableOrderIds = useMemo(() => {
    return Array.from(
      new Set(
        filteredGroupedRows.flatMap((row) => {
          if (!selectedOrderIds.includes(row.id)) {
            return [];
          }

          const printableOrderIds = (row.individualOrders ?? [])
            .filter((order) => canPrintShippingLabel(order))
            .map((order) => order.id);

          if (printableOrderIds.length > 0) {
            return printableOrderIds;
          }

          return canPrintShippingLabel(row) ? [row.id] : [];
        }),
      ),
    );
  }, [filteredGroupedRows, selectedOrderIds]);

  const selectedPrintableRowsCount = useMemo(() => {
    return filteredGroupedRows.filter((row) => {
      if (!selectedOrderIds.includes(row.id)) {
        return false;
      }

      const printableOrderIds = (row.individualOrders ?? [])
        .filter((order) => canPrintShippingLabel(order))
        .map((order) => order.id);

      return printableOrderIds.length > 0 || canPrintShippingLabel(row);
    }).length;
  }, [filteredGroupedRows, selectedOrderIds]);

  const selectedPrintableRowsTotalAmount = useMemo(() => {
    return filteredGroupedRows.reduce((sum, row) => {
      if (!selectedOrderIds.includes(row.id)) {
        return sum;
      }

      const printableOrderIds = (row.individualOrders ?? [])
        .filter((order) => canPrintShippingLabel(order))
        .map((order) => order.id);

      if (printableOrderIds.length === 0 && !canPrintShippingLabel(row)) {
        return sum;
      }

      return sum + Number(row.totalAmount);
    }, 0);
  }, [filteredGroupedRows, selectedOrderIds]);

  const selectedPrintableRowsCurrency = useMemo(() => {
    return (
      filteredGroupedRows.find((row) => {
        if (!selectedOrderIds.includes(row.id)) {
          return false;
        }

        const printableOrderIds = (row.individualOrders ?? [])
          .filter((order) => canPrintShippingLabel(order))
          .map((order) => order.id);

        return printableOrderIds.length > 0 || canPrintShippingLabel(row);
      })?.currency ?? 'CLP'
    );
  }, [filteredGroupedRows, selectedOrderIds]);

  const selectedPrintableRowsEstimatedAmount = useMemo<number | null>(() => {
    return filteredGroupedRows.reduce<number | null>((sum, row) => {
      if (!selectedOrderIds.includes(row.id)) {
        return sum;
      }

      const printableOrderIds = (row.individualOrders ?? [])
        .filter((order) => canPrintShippingLabel(order))
        .map((order) => order.id);

      if (printableOrderIds.length === 0 && !canPrintShippingLabel(row)) {
        return sum;
      }

      if (
        sum === null ||
        row.estimatedNetBeforeCost === null ||
        row.estimatedNetBeforeCost === undefined
      ) {
        return null;
      }

      return sum + Number(row.estimatedNetBeforeCost);
    }, 0);
  }, [filteredGroupedRows, selectedOrderIds]);

  const allSelectableRowsSelected =
    selectableRowIds.size > 0 && Array.from(selectableRowIds).every((rowId) => selectedOrderIds.includes(rowId));

  useEffect(() => {
    setSelectedOrderIds((current) => {
      const next = current.filter((rowId) => selectableRowIds.has(rowId));

      if (next.length === current.length && next.every((rowId, index) => rowId === current[index])) {
        return current;
      }

      return next;
    });
  }, [selectableRowIds]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    manualSyncOrders.mutate(accountId || allAccountsValue);
  }

  function openModal() {
    setError(null);
    setAccountId(accountOptions.length > 1 ? allAccountsValue : (accounts[0]?.id ?? ''));
    setIsOpen(true);
  }

  function changeFilter(
    nextFilter: 'shippingToday' | 'upcoming' | 'inTransit' | 'finalized',
  ) {
    if (nextFilter === filter) {
      return;
    }

    startTransition(() => {
      setFilter(nextFilter);
      if (nextFilter !== 'shippingToday') {
        setShippingStageFilter('all');
      }
      if (nextFilter !== 'upcoming') {
        setUpcomingStageFilter('all');
      }
      if (nextFilter !== 'inTransit') {
        setInTransitStageFilter('all');
      }
      if (nextFilter !== 'finalized') {
        setFinalizedStageFilter('all');
      }
    });
  }

  const orderColumns = useMemo(
    () =>
      createOrderColumns({
        selectedRowIds: new Set(selectedOrderIds),
        onToggleRowSelection: (rowId) => {
          setOpenActionMenuId(null);
          setSelectedOrderIds((current) =>
            current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId],
          );
        },
        onToggleAllSelection: () => {
          setOpenActionMenuId(null);
          setSelectedOrderIds((current) =>
            allSelectableRowsSelected ? current.filter((rowId) => !selectableRowIds.has(rowId)) : Array.from(new Set([...current, ...Array.from(selectableRowIds)])),
          );
        },
        isSelectable: (row) => selectableRowIds.has(row.id),
        allSelectableRowsSelected,
        hasSelectableRows: selectableRowIds.size > 0,
        openActionMenuId,
        onToggleActionMenu: (rowId) => {
          setOpenActionMenuId((current) => (current === rowId ? null : rowId));
        },
        onOpenSummary: (row) => {
          setActionError(null);
          setSelectedOrder(row);
        },
        onOpenMessages: handleOpenMessages,
        onCancelOrder: handleCancelOrder,
        onPrintLabel: handlePrintLabel,
        cancellingOrderId,
        printingOrderId,
      }),
    [allSelectableRowsSelected, cancellingOrderId, openActionMenuId, printingOrderId, selectableRowIds, selectedOrderIds],
  );

  async function handleBulkPrintReadyLabels() {
    if (readyToPrintOrderIds.length === 0) {
      return;
    }

    try {
      setActionError(null);
      setIsBulkPrinting(true);
      await openBulkShippingLabelPdf(readyToPrintOrderIds);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'No pudimos preparar la impresión masiva de etiquetas.',
      );
    } finally {
      setIsBulkPrinting(false);
    }
  }

  async function handleBulkPrintSelectedLabels() {
    if (selectedPrintableOrderIds.length === 0) {
      return;
    }

    try {
      setActionError(null);
      setIsBulkPrinting(true);
      await openBulkShippingLabelPdf(selectedPrintableOrderIds);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'No pudimos preparar la impresión de las etiquetas seleccionadas.',
      );
    } finally {
      setIsBulkPrinting(false);
    }
  }

  return (
    <>
      <style jsx global>{`
        @keyframes syncShimmer {
          0% {
            transform: translateX(0%);
            opacity: 0.2;
          }

          50% {
            opacity: 0.95;
          }

          100% {
            transform: translateX(320%);
            opacity: 0.2;
          }
        }
      `}</style>
      <PageShell
        title="Órdenes centralizadas"
        description="Consulta y filtra todas las ventas importadas desde tus canales sin saltar entre plataformas."
        actionContent={
          <button
            type="button"
            onClick={openModal}
            disabled={accountOptions.length === 0 || manualSyncOrders.isPending}
            className={`relative inline-flex max-w-[320px] items-center gap-2 overflow-hidden rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${
              manualSyncOrders.isPending
                ? 'bg-[linear-gradient(135deg,#0f172a_0%,#1e3a5f_48%,#0ea5e9_100%)] shadow-sky/20'
                : 'bg-gradient-to-r from-moss to-aurora shadow-moss/20 hover:scale-[1.01]'
            }`}
            title="Trae historial reciente y mejora órdenes y mensajería"
          >
            {manualSyncOrders.isPending ? (
              <span
                className="pointer-events-none absolute inset-0 opacity-70"
                aria-hidden="true"
              >
                <span className="absolute inset-y-0 left-[-35%] w-1/3 animate-[syncShimmer_1.4s_ease-in-out_infinite] bg-white/15 blur-xl" />
              </span>
            ) : null}
            {manualSyncOrders.isPending ? (
              <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-white/90" />
            ) : (
              <RefreshCcw className="h-4 w-4 shrink-0 text-white/90" />
            )}
            <span>{manualSyncOrders.isPending ? 'Sincronizando órdenes...' : 'Sincronizar órdenes'}</span>
          </button>
        }
      >
        {isLoading ? (
          <QueryState
            title="Cargando órdenes"
            description="Estamos trayendo la bandeja unificada desde la API."
          />
        ) : isError ? (
          <QueryState
            title="No pudimos cargar órdenes"
            description="Revisa si la API sigue activa y vuelve a intentar."
          />
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="flex flex-wrap items-center gap-2.5">
                  <FilterChip
                    label="Envíos de hoy"
                    count={shippingTodayCount}
                    active={filter === 'shippingToday'}
                    onClick={() => changeFilter('shippingToday')}
                    variant="tab"
                    className="min-w-[132px]"
                  />
                  <FilterChip
                    label="Próximos días"
                    count={upcomingCount}
                    active={filter === 'upcoming'}
                    onClick={() => changeFilter('upcoming')}
                    variant="tab"
                    className="min-w-[132px]"
                  />
                  <FilterChip
                    label="En transito"
                    count={inTransitCount}
                    active={filter === 'inTransit'}
                    onClick={() => changeFilter('inTransit')}
                    variant="tab"
                    className="min-w-[112px]"
                  />
                  <FilterChip
                    label="Finalizado"
                    count={finalizedCount}
                    active={filter === 'finalized'}
                    onClick={() => changeFilter('finalized')}
                    variant="tab"
                    className="min-w-[112px]"
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3 xl:justify-end">
                  <div className="w-[180px]">
                    <label className="mb-1.5 block text-[11px] font-medium text-ink/50">
                      Plataforma
                    </label>
                    <div ref={platformMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (hasSinglePlatformOption) {
                            return;
                          }

                          setIsAccountMenuOpen(false);
                          setIsShippingTypeMenuOpen(false);
                          setIsPlatformMenuOpen((current) => !current);
                        }}
                        disabled={hasSinglePlatformOption}
                        className={selectorClassName()}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          {selectedPlatform ? (
                            <PlatformLogo platform={selectedPlatform} className="h-4 w-4 shrink-0" />
                          ) : (
                            <Filter className="h-4 w-4 shrink-0 text-ink/40" />
                          )}
                          <span className="truncate">{selectedPlatformLabel}</span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-ink/35" />
                      </button>
                      {isPlatformMenuOpen && !hasSinglePlatformOption ? (
                        <div className="absolute left-0 z-20 mt-2 min-w-full rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPlatform('');
                              setIsPlatformMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                              !selectedPlatform
                                ? 'bg-slate-100 font-semibold text-night'
                                : 'text-ink/75 hover:bg-slate-50'
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Filter className="h-4 w-4 text-ink/45" />
                              <span>Todas las plataformas</span>
                            </span>
                          </button>
                          {platformOptions.map((platform) => (
                            <button
                              key={platform.value}
                              type="button"
                              onClick={() => {
                                setSelectedPlatform(platform.value);
                                setIsPlatformMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                                selectedPlatform === platform.value
                                  ? 'bg-slate-100 font-semibold text-night'
                                  : 'text-ink/75 hover:bg-slate-50'
                              }`}
                            >
                              <span className="inline-flex items-center gap-2">
                                <PlatformLogo platform={platform.value} className="h-4 w-4 shrink-0" />
                                <span>{platform.label}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="w-[220px]">
                    <label className="mb-1.5 block text-[11px] font-medium text-ink/50">
                      Cuenta
                    </label>
                    <div ref={accountMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (hasSingleAccountOption) {
                            return;
                          }

                          setIsPlatformMenuOpen(false);
                          setIsShippingTypeMenuOpen(false);
                          setIsAccountMenuOpen((current) => !current);
                        }}
                        disabled={hasSingleAccountOption}
                        className={selectorClassName()}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-ink/40" />
                          <span className="truncate">{selectedAccountLabel}</span>
                        </span>
                        <ChevronDown className="h-4 w-4 shrink-0 text-ink/35" />
                      </button>
                      {isAccountMenuOpen && !hasSingleAccountOption ? (
                        <div className="absolute left-0 z-20 mt-2 min-w-full rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAccountId('');
                              setIsAccountMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                              !selectedAccountId
                                ? 'bg-slate-100 font-semibold text-night'
                                : 'text-ink/75 hover:bg-slate-50'
                            }`}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-ink/45" />
                              <span>Todas las cuentas</span>
                            </span>
                          </button>
                          {accountOptions.map((account) => (
                            <button
                              key={account.value}
                              type="button"
                              onClick={() => {
                                setSelectedAccountId(account.value);
                                setIsAccountMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                                selectedAccountId === account.value
                                  ? 'bg-slate-100 font-semibold text-night'
                                  : 'text-ink/75 hover:bg-slate-50'
                              }`}
                            >
                              <span className="inline-flex min-w-0 items-center gap-2">
                                <Building2 className="h-4 w-4 shrink-0 text-ink/45" />
                                <span className="truncate">{account.label}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              {filter === 'shippingToday' ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
                        Etapas
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                  <FilterChip
                    label="Todas"
                    count={shippingTodayCount}
                    active={shippingStageFilter === 'all'}
                    onClick={() => setShippingStageFilter('all')}
                  />
                  <FilterChip
                    label="Etiqueta por imprimir"
                    count={shippingStageCounts.ready_to_print}
                    active={shippingStageFilter === 'ready_to_print'}
                    disabled={shippingStageCounts.ready_to_print === 0}
                    onClick={() => setShippingStageFilter('ready_to_print')}
                  />
                  <FilterChip
                    label="Listas para despacho"
                    count={shippingStageCounts.ready_to_ship}
                    active={shippingStageFilter === 'ready_to_ship'}
                    disabled={shippingStageCounts.ready_to_ship === 0}
                    onClick={() => setShippingStageFilter('ready_to_ship')}
                  />
                  <FilterChip
                    label="En tránsito"
                    count={shippingStageCounts.shipped}
                    active={shippingStageFilter === 'shipped'}
                    disabled={shippingStageCounts.shipped === 0}
                    onClick={() => setShippingStageFilter('shipped')}
                  />
                  <FilterChip
                    label="Demoradas"
                    count={shippingStageCounts.overdue}
                    active={shippingStageFilter === 'overdue'}
                    disabled={shippingStageCounts.overdue === 0}
                    onClick={() => setShippingStageFilter('overdue')}
                  />
                  <FilterChip
                    label="Reprogramadas"
                    count={shippingStageCounts.rescheduled}
                    active={shippingStageFilter === 'rescheduled'}
                    disabled={shippingStageCounts.rescheduled === 0}
                    onClick={() => setShippingStageFilter('rescheduled')}
                  />
                  <FilterChip
                    label="Entregadas"
                    count={shippingStageCounts.delivered}
                    active={shippingStageFilter === 'delivered'}
                    disabled={shippingStageCounts.delivered === 0}
                    onClick={() => setShippingStageFilter('delivered')}
                  />
                  <FilterChip
                    label="Canceladas"
                    count={shippingStageCounts.cancelled}
                    active={shippingStageFilter === 'cancelled'}
                    disabled={shippingStageCounts.cancelled === 0}
                    onClick={() => setShippingStageFilter('cancelled')}
                  />
                  </div>
                </div>
              ) : null}
              {filter === 'upcoming' ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
                        Etapas
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FilterChip
                      label="Todas"
                      count={upcomingCount}
                      active={upcomingStageFilter === 'all'}
                      onClick={() => setUpcomingStageFilter('all')}
                    />
                    <FilterChip
                      label="Etiqueta por imprimir"
                      count={upcomingStageCounts.ready_to_print}
                      active={upcomingStageFilter === 'ready_to_print'}
                      disabled={upcomingStageCounts.ready_to_print === 0}
                      onClick={() => setUpcomingStageFilter('ready_to_print')}
                    />
                    <FilterChip
                      label="Listas para despacho"
                      count={upcomingStageCounts.ready_to_ship}
                      active={upcomingStageFilter === 'ready_to_ship'}
                      disabled={upcomingStageCounts.ready_to_ship === 0}
                      onClick={() => setUpcomingStageFilter('ready_to_ship')}
                    />
                  </div>
                </div>
              ) : null}
              {filter === 'inTransit' ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
                        Etapas
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FilterChip
                      label="Todas"
                      count={inTransitCount}
                      active={inTransitStageFilter === 'all'}
                      onClick={() => setInTransitStageFilter('all')}
                    />
                    <FilterChip
                      label="En tránsito"
                      count={inTransitStageCounts.shipped}
                      active={inTransitStageFilter === 'shipped'}
                      disabled={inTransitStageCounts.shipped === 0}
                      onClick={() => setInTransitStageFilter('shipped')}
                    />
                    <FilterChip
                      label="Demoradas"
                      count={inTransitStageCounts.overdue}
                      active={inTransitStageFilter === 'overdue'}
                      disabled={inTransitStageCounts.overdue === 0}
                      onClick={() => setInTransitStageFilter('overdue')}
                    />
                    <FilterChip
                      label="Reprogramadas"
                      count={inTransitStageCounts.rescheduled}
                      active={inTransitStageFilter === 'rescheduled'}
                      disabled={inTransitStageCounts.rescheduled === 0}
                      onClick={() => setInTransitStageFilter('rescheduled')}
                    />
                  </div>
                </div>
              ) : null}
              {filter === 'finalized' ? (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/45">
                        Etapas
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <FilterChip
                      label="Todas"
                      count={finalizedCount}
                      active={finalizedStageFilter === 'all'}
                      onClick={() => setFinalizedStageFilter('all')}
                    />
                    <FilterChip
                      label="Entregadas"
                      count={finalizedStageCounts.delivered}
                      active={finalizedStageFilter === 'delivered'}
                      disabled={finalizedStageCounts.delivered === 0}
                      onClick={() => setFinalizedStageFilter('delivered')}
                    />
                    <FilterChip
                      label="Canceladas"
                      count={finalizedStageCounts.cancelled}
                      active={finalizedStageFilter === 'cancelled'}
                      disabled={finalizedStageCounts.cancelled === 0}
                      onClick={() => setFinalizedStageFilter('cancelled')}
                    />
                    <FilterChip
                      label="Reprogramadas"
                      count={finalizedStageCounts.rescheduled}
                      active={finalizedStageFilter === 'rescheduled'}
                      disabled={finalizedStageCounts.rescheduled === 0}
                      onClick={() => setFinalizedStageFilter('rescheduled')}
                    />
                  </div>
                </div>
              ) : null}
              {actionError ? (
                <p className="text-sm font-medium text-rose-700">{actionError}</p>
              ) : null}
              {(selectableRowIds.size > 0 || selectedPrintableRowsCount > 0) ? (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {selectedPrintableRowsCount > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTotalsMode((current) =>
                          current === 'gross' ? 'estimated' : 'gross',
                        )
                      }
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] text-ink/55 transition hover:border-slate-300 hover:text-ink"
                    >
                      <span>
                        {selectedTotalsMode === 'gross'
                          ? 'Total venta seleccionado:'
                          : 'Neto después de cargos ML:'}
                      </span>
                      <span className="font-semibold text-night">
                        {selectedTotalsMode === 'gross'
                          ? formatCurrency(
                              selectedPrintableRowsTotalAmount,
                              selectedPrintableRowsCurrency,
                            )
                          : selectedPrintableRowsEstimatedAmount === null
                            ? 'Sin estimado'
                            : formatCurrency(
                                selectedPrintableRowsEstimatedAmount,
                                selectedPrintableRowsCurrency,
                              )}
                      </span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleBulkPrintSelectedLabels()}
                    disabled={selectedPrintableOrderIds.length === 0 || isBulkPrinting}
                    className="rounded-full border border-night bg-night px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {isBulkPrinting
                      ? 'Preparando PDF...'
                      : `Imprimir etiquetas (${selectedPrintableRowsCount})`}
                  </button>
                </div>
              ) : null}
            </div>

            <DataTable
              data={filteredGroupedRows}
              columns={orderColumns}
              title="Ventas"
              description="Órdenes recientes consolidadas en una sola mesa de trabajo"
              searchPlaceholder="Buscar orden o cliente"
              headerActions={
                <div ref={shippingTypeMenuRef} className="relative">
                  <button
                    type="button"
                    aria-label="Filtrar por tipo de envío"
                    title={
                      shippingTypeFilter === 'all'
                        ? 'Filtrar por tipo de envío'
                        : shippingTypeFilter === 'flex'
                          ? 'Filtro activo: Flex'
                          : 'Filtro activo: Mercado Envíos'
                    }
                    onClick={() => {
                      setIsPlatformMenuOpen(false);
                      setIsAccountMenuOpen(false);
                      setIsShippingTypeMenuOpen((current) => !current);
                    }}
                    className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-white text-ink transition hover:border-slate-300 ${
                      shippingTypeFilter === 'all'
                        ? 'border-black/10'
                        : 'border-slate-300 bg-slate-50 text-night'
                    }`}
                  >
                    <Filter className="h-4 w-4" />
                    {shippingTypeFilter !== 'all' ? (
                      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sky" />
                    ) : null}
                  </button>

                  {isShippingTypeMenuOpen ? (
                    <div className="absolute right-0 z-20 mt-2 min-w-[220px] rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
                      {[
                        { value: 'all' as const, label: 'Todos los envíos' },
                        { value: 'flex' as const, label: 'Flex' },
                        { value: 'mercado_envios' as const, label: 'Mercado Envíos' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setShippingTypeFilter(option.value);
                            setIsShippingTypeMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                            shippingTypeFilter === option.value
                              ? 'bg-slate-100 font-semibold text-night'
                              : 'text-ink/75 hover:bg-slate-50'
                          }`}
                        >
                          <span>{option.label}</span>
                          {shippingTypeFilter === option.value ? (
                            <span className="text-xs text-ink/45">Activo</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              }
            />
          </div>
        )}
      </PageShell>

      {syncFeedback ? (
        <FeedbackToast
          tone={syncFeedback.tone}
          title={syncFeedback.title}
          message={syncFeedback.message}
          details={syncFeedback.details}
          onClose={() => setSyncFeedback(null)}
        />
      ) : null}

      <Modal
        open={isOpen}
        onClose={() => !manualSyncOrders.isPending && setIsOpen(false)}
        title="Sincronizar órdenes"
        description="Elige una cuenta o sincroniza todas usando el mismo proceso incremental de órdenes nuevas."
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {manualSyncOrders.isPending ? (
            <div className="overflow-hidden rounded-[1.4rem] border border-sky-200/80 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(224,242,254,0.92))] p-4 shadow-[0_12px_28px_rgba(14,165,233,0.08)]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-sky shadow-sm">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-sky-950">Sincronización en curso</p>
                  <p className="mt-1 text-sm text-sky-900/75">
                    Estamos consultando Mercado Libre y actualizando órdenes. Puedes esperar aquí; te avisaremos al terminar.
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80 ring-1 ring-sky-200/70">
                    <div className="h-full w-1/3 animate-[syncShimmer_1.2s_ease-in-out_infinite] rounded-full bg-[linear-gradient(90deg,rgba(14,165,233,0.2),rgba(14,165,233,0.9),rgba(45,212,191,0.6))]" />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <FieldGroup label="Cuenta" required>
            <select
              required
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              disabled={accountOptions.length === 1 || manualSyncOrders.isPending}
              className={inputClassName()}
            >
              {accountOptions.length > 1 ? (
                <option value={allAccountsValue}>Todas las cuentas</option>
              ) : null}
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </FieldGroup>

          {error ? <FormMessage>{error}</FormMessage> : null}
          <FormActions
            submitLabel="Sincronizar ahora"
            submitting={manualSyncOrders.isPending}
            onCancel={() => setIsOpen(false)}
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={
          selectedOrder
            ? (
                <span className="inline-flex items-center gap-3">
                  <PlatformLogo
                    platform={selectedOrder.platform}
                    className="h-5 w-5 shrink-0"
                  />
                  <span className="inline-flex items-center gap-2">
                    <span>
                    {selectedOrder.packId
                      ? `Pack ${selectedOrder.packId}`
                      : `Orden ${selectedOrder.orderNumber}`}
                    </span>
                    <CopyButton
                      value={selectedOrder.packId ?? selectedOrder.orderNumber}
                      label={selectedOrder.packId ? 'Copiar pack' : 'Copiar orden'}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      iconClassName="h-3.5 w-3.5"
                    />
                  </span>
                </span>
              )
            : 'Resumen'
        }
        description={
          selectedOrder
            ? [
                selectedOrderDetail?.account?.name || selectedOrder.account || 'Sin cuenta',
                formatPurchaseTime(selectedOrderDetail?.order.placedAt ?? selectedOrder.placedAt ?? selectedOrder.createdAt)
                  ? `Venta ${formatPurchaseTime(
                      selectedOrderDetail?.order.placedAt ??
                        selectedOrder.placedAt ??
                        selectedOrder.createdAt,
                    )}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      >
        {selectedOrder ? (
          isLoadingSelectedOrder ? (
            <QueryState
              title="Cargando resumen"
              description="Estamos buscando el detalle completo de la orden."
            />
          ) : isSelectedOrderError || !selectedOrderDetail ? (
            <QueryState
              title="No pudimos cargar el resumen"
              description="Vuelve a intentarlo en unos segundos."
            />
          ) : (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_28%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_34%),linear-gradient(145deg,rgba(255,255,255,1),rgba(246,250,252,0.98))] px-5 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)] sm:px-6 sm:py-6">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent" />
                <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start">
                  <div>
                    {hasStackedSelectedOrderImages ? (
                      <div className="flex h-24 w-[110px] items-center sm:h-28 sm:w-[132px]">
                        <div className="relative h-24 w-[110px] sm:h-28 sm:w-[132px]">
                          {selectedOrderPreviewImages.slice(-3).map((imageUrl, index, images) => (
                            <img
                              key={`${imageUrl}-${index}`}
                              src={imageUrl}
                              alt=""
                              aria-hidden="true"
                              className="absolute top-0 h-24 w-24 rounded-3xl object-cover ring-2 ring-white shadow-[0_12px_28px_rgba(15,23,42,0.16)] sm:h-28 sm:w-28"
                              style={{
                                left: `${index * 18}px`,
                                zIndex: 20 + index,
                                transform: `rotate(${index === 0 ? -5 : index === 1 ? 2 : 7}deg)`,
                              }}
                            />
                          ))}
                          {selectedOrderPreviewImages.length > 3 ? (
                            <div className="absolute bottom-0 right-0 z-40 inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/90 bg-night px-2 text-xs font-semibold text-white shadow-lg">
                              +{selectedOrderPreviewImages.length - 3}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : selectedOrderPreviewImages[0] ? (
                      <img
                        src={selectedOrderPreviewImages[0]}
                        alt={selectedOrder.productTitle ?? 'Producto de la orden'}
                        className="h-24 w-24 rounded-3xl object-cover shadow-[0_10px_30px_rgba(15,23,42,0.14)] ring-1 ring-white/70 sm:h-28 sm:w-28"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/90 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/40 shadow-[0_10px_30px_rgba(15,23,42,0.08)] sm:h-28 sm:w-28">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs uppercase tracking-[0.24em] text-ink/45">
                          Resumen rápido
                        </p>
                        {selectedOrderStatusMeta ? (
                          <StatusBadge tone={selectedOrderStatusMeta.tone} icon={selectedOrderStatusMeta.icon}>
                            {selectedOrderStatusMeta.label}
                          </StatusBadge>
                        ) : null}
                        {formatOrderShippingTypeLabel(selectedOrder.shippingType) ? (
                          <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800">
                            {formatOrderShippingTypeLabel(selectedOrder.shippingType)}
                          </span>
                        ) : null}
                        {selectedOrder.hasMessages ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                            <svg
                              viewBox="0 0 20 20"
                              fill="none"
                              aria-hidden="true"
                              className="h-3.5 w-3.5"
                            >
                              <path
                                d="M4.167 5.833A2.5 2.5 0 0 1 6.667 3.333h6.666a2.5 2.5 0 0 1 2.5 2.5v4.334a2.5 2.5 0 0 1-2.5 2.5H9.57l-3.086 2.468a.5.5 0 0 1-.817-.39v-2.078a2.5 2.5 0 0 1-1.5-2.287V5.833Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                            {(selectedOrder.unreadMessagesCount ?? 0) > 0
                              ? `${selectedOrder.unreadMessagesCount ?? 0} mensaje${(selectedOrder.unreadMessagesCount ?? 0) === 1 ? '' : 's'}`
                              : 'Tiene mensajes'}
                          </span>
                        ) : null}
                    </div>
                    <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-night sm:text-[1.8rem]">
                      {isGroupedSelectedOrder
                        ? `${selectedOrderCount} órdenes en la venta`
                        : selectedOrder.productTitle ?? 'Producto sin título'}
                    </p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/65">
                      {isGroupedSelectedOrder
                        ? 'Resumen rápido de la venta agrupada antes del detalle por orden.'
                        : 'Vista resumida de la orden seleccionada'}
                    </p>
                  </div>
                  <div className="lg:pl-2">
                    <div className="inline-flex min-w-[170px] flex-col gap-3 rounded-[1.5rem] border border-emerald-200/90 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(209,250,229,0.92))] px-4 py-3 shadow-[0_16px_34px_rgba(16,185,129,0.12)]">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700/80">
                          Total del pack
                        </span>
                        <span className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-emerald-950">
                          {formatCurrency(
                            Number(
                              isGroupedSelectedOrder
                                ? selectedOrder.totalAmount
                                : selectedOrderDetail.order.totalAmount,
                            ),
                            isGroupedSelectedOrder
                              ? selectedOrder.currency
                              : selectedOrderDetail.order.currency,
                          )}
                        </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,0.98))] p-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'products' as const, label: 'Productos' },
                  { id: 'finance' as const, label: 'Finanzas' },
                  { id: 'activity' as const, label: 'Actividad' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedOrderTab(tab.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      selectedOrderTab === tab.id
                        ? 'border border-night bg-night text-white shadow-[0_8px_18px_rgba(15,23,42,0.16)]'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                </div>
              </div>

              {selectedOrderTab === 'products' ? (
                <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
                  <section className="rounded-[1.7rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                    <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
                      {isGroupedSelectedOrder ? 'Órdenes incluidas' : 'Productos'}
                    </p>
                    <p className="mt-2 text-sm text-ink/60">
                      {isGroupedSelectedOrder
                        ? 'Vista detallada de cada orden dentro de la misma venta.'
                        : 'Vista detallada del producto incluido en la orden.'}
                    </p>
                    <div className="mt-3 space-y-3">
                      {isGroupedSelectedOrder ? (
                        (selectedOrder.individualOrders ?? []).map((order) => (
                          <div
                            key={order.externalOrderId}
                            className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 rounded-[1.4rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.85),rgba(255,255,255,0.98))] px-4 py-4 shadow-sm"
                          >
                            {normalizeImageUrl(order.productImageUrl) ? (
                              <img
                                src={normalizeImageUrl(order.productImageUrl)!}
                                alt={order.productTitle ?? 'Producto de la orden'}
                                className="h-[72px] w-[72px] rounded-2xl object-cover ring-1 ring-slate-200"
                              />
                            ) : (
                              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">
                                Sin foto
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-6 text-night">
                                {order.productTitle ?? 'Producto sin título'}
                              </p>
                              <p className="mt-1 text-sm font-medium text-ink/60">
                                {formatCurrency(order.totalAmount, selectedOrder.currency)}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-ink/60">
                                  <span>{order.orderNumber}</span>
                                  <CopyButton value={order.orderNumber} label="Copiar orden" />
                                </span>
                                {Number(order.totalUnits ?? 0) > 0 ? (
                                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-ink/60">
                                    Cantidad: {order.totalUnits}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : selectedOrderDetail.items.length > 0 ? (
                        selectedOrderDetail.items.map((item, index) => (
                          <div
                            key={`${item.title}-${index}`}
                            className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 rounded-[1.4rem] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.85),rgba(255,255,255,0.98))] px-4 py-4 shadow-sm"
                          >
                            {selectedOrderPreviewImages[0] ? (
                              <img
                                src={selectedOrderPreviewImages[0]}
                                alt={item.title}
                                className="h-[72px] w-[72px] rounded-2xl object-cover ring-1 ring-slate-200"
                              />
                            ) : (
                              <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">
                                Sin foto
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold leading-6 text-night">
                                {item.title}
                              </p>
                              <p className="mt-1 text-sm font-medium text-ink/60">
                                {formatCurrency(
                                  Number(selectedOrderDetail.order.totalAmount),
                                  selectedOrderDetail.order.currency,
                                )}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-ink/60">
                                  <span>{selectedOrderDetail.order.orderNumber}</span>
                                  <CopyButton value={selectedOrderDetail.order.orderNumber} label="Copiar orden" />
                                </span>
                                <span className="inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium text-ink/60">
                                  Cantidad: {item.quantity}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-ink/55">Sin detalle de productos.</p>
                      )}
                    </div>
                  </section>
                  {renderOrderSidebar()}
                </div>
              ) : null}

              {selectedOrderTab === 'finance' ? (
                selectedOrderDetail.mercadolibreFinancials ? (
                  <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
                    <section className="rounded-[1.7rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
                            Detalle ML
                          </p>
                          <p className="mt-2 text-sm text-ink/60">
                            Desglose financiero de la venta según los pagos registrados por Mercado Libre.
                          </p>
                        </div>
                        <StatusBadge tone="positive">Neto después de cargos</StatusBadge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,0.96))] px-4 py-3 shadow-sm">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
                            Venta base
                          </p>
                          <p className="mt-2 text-lg font-semibold text-night">
                            {formatCurrency(
                              selectedOrderDetail.mercadolibreFinancials.saleBase,
                              selectedOrderDetail.order.currency,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(220,252,231,0.92))] px-4 py-3 shadow-sm">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700/75">
                            Neto después de cargos ML
                          </p>
                          <p className="mt-2 text-lg font-semibold text-emerald-900">
                            {formatCurrency(
                              selectedOrderDetail.mercadolibreFinancials.estimatedNetBeforeCost,
                              selectedOrderDetail.order.currency,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
                            Cargos por venta
                          </p>
                          <p className="mt-2 text-sm font-semibold text-rose-700">
                            {formatCurrency(
                              selectedOrderDetail.mercadolibreFinancials.marketplaceFee,
                              selectedOrderDetail.order.currency,
                            )}
                          </p>
                        </div>
                        {Number(selectedOrderDetail.mercadolibreFinancials.taxesAmount) !== 0 ? (
                          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
                              Impuestos ML
                            </p>
                            <p className="mt-2 text-sm font-semibold text-rose-700">
                              {formatCurrency(
                                selectedOrderDetail.mercadolibreFinancials.taxesAmount,
                                selectedOrderDetail.order.currency,
                              )}
                            </p>
                          </div>
                        ) : null}
                        {selectedOrderDetail.mercadolibreFinancials.bonusAmount > 0 ? (
                          <div className="rounded-2xl border border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(220,252,231,0.92))] px-4 py-3 shadow-sm">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700/75">
                              Bonificaciones
                            </p>
                            <p className="mt-2 text-sm font-semibold text-emerald-900">
                              {formatCurrency(
                                selectedOrderDetail.mercadolibreFinancials.bonusAmount,
                                selectedOrderDetail.order.currency,
                              )}
                            </p>
                          </div>
                        ) : null}
                        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
                            Total pagado cliente
                          </p>
                          <p className="mt-2 text-sm font-semibold text-night">
                            {formatCurrency(
                              selectedOrderDetail.mercadolibreFinancials.totalPaidAmount,
                              selectedOrderDetail.order.currency,
                            )}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
                            Envíos
                          </p>
                          <p className="mt-2 text-sm font-semibold text-night">
                            {formatCurrency(
                              selectedOrderDetail.mercadolibreFinancials.shippingCost,
                              selectedOrderDetail.order.currency,
                            )}
                          </p>
                        </div>
                        {selectedOrderDetail.mercadolibreFinancials.customerShippingAmount > 0 ? (
                          <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
                              Envío cliente cobrado
                            </p>
                            <p className="mt-2 text-sm font-semibold text-night">
                              {formatCurrency(
                                selectedOrderDetail.mercadolibreFinancials.customerShippingAmount,
                                selectedOrderDetail.order.currency,
                              )}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </section>

                    {renderOrderSidebar()}
                  </div>
                ) : (
                  <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
                    <div className="rounded-[1.7rem] border border-slate-200/80 bg-white px-5 py-10 text-center shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <p className="text-sm font-medium text-night">Sin detalle financiero de Mercado Libre</p>
                      <p className="mt-2 text-sm text-ink/55">
                        Esta orden todavía no trae pagos suficientes para mostrar el desglose financiero.
                      </p>
                    </div>
                    {renderOrderSidebar()}
                  </div>
                )
              ) : null}

              {selectedOrderTab === 'activity' ? (
                <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.78fr)]">
                  <div className="space-y-5">
                    <section className="rounded-[1.7rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
                        Entrega
                      </p>
                      <div className="mt-4 space-y-4 text-sm text-ink/75">
                        <div className="space-y-1">
                          <p className="font-semibold text-night">
                            {selectedOrderDetail.order.shippingName || 'Sin destinatario'}
                          </p>
                          <p className="text-sm leading-7 text-night">
                            {[
                              selectedOrderDetail.order.shippingAddress1,
                              selectedOrderDetail.order.shippingAddress2,
                              selectedOrderDetail.order.shippingCity,
                              selectedOrderDetail.order.shippingRegion,
                              selectedOrderDetail.order.shippingPostalCode,
                              selectedOrderDetail.order.shippingCountry,
                            ]
                              .filter(Boolean)
                              .join(', ') || 'Sin dirección completa'}
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,0.96))] px-4 py-3 shadow-sm">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
                              Comuna
                            </p>
                            <p className="mt-2 font-medium text-night">
                              {selectedOrderDetail.order.shippingCity || 'Sin comuna'}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,0.96))] px-4 py-3 shadow-sm">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink/40">
                              Región y país
                            </p>
                            <p className="mt-2 font-medium text-night">
                              {[
                                selectedOrderDetail.order.shippingRegion,
                                selectedOrderDetail.order.shippingCountry,
                              ]
                                .filter(Boolean)
                                .join(' · ') || 'Sin región'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                    <section className="rounded-[1.7rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
                        Seguimiento interno
                      </p>
                      <div className="mt-3 space-y-3 text-sm text-ink/75">
                        <p>
                          Asignado a:{' '}
                          <span className="font-semibold text-night">
                            {selectedOrderDetail.assignment?.user?.fullName ||
                              selectedOrderDetail.assignment?.user?.email ||
                              'Sin asignación'}
                          </span>
                        </p>
                        {selectedOrderDetail.assignment?.note ? (
                          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-ink/70">
                            {selectedOrderDetail.assignment.note}
                          </div>
                        ) : (
                          <p className="text-ink/55">Sin nota interna.</p>
                        )}
                        {selectedOrderDetail.tags?.length ? (
                          <div className="flex flex-wrap gap-2">
                            {selectedOrderDetail.tags.map((tag, index) => (
                              <span
                                key={`${tag.name}-${index}`}
                                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                              >
                                {tag.name || 'Tag'}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </section>
                    <section className="rounded-[1.7rem] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                      <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
                        Comentarios
                      </p>
                      <div className="mt-3 space-y-3">
                        {selectedOrderDetail.comments?.length ? (
                          selectedOrderDetail.comments.slice(0, 6).map((comment, index) => (
                            <div
                              key={`${comment.createdAt}-${index}`}
                              className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,0.96))] px-4 py-3 text-sm text-ink/75"
                            >
                              <p className="font-semibold text-night">
                                {comment.user?.fullName || comment.user?.email || 'Equipo'}
                              </p>
                              <p className="mt-1">{comment.body || 'Sin comentario'}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-ink/55">Sin comentarios recientes.</p>
                        )}
                      </div>
                    </section>
                  </div>
                  {renderOrderSidebar()}
                </div>
              ) : null}
            </div>
          )
        ) : null}
      </Modal>

      <Modal
        open={Boolean(pendingCancelOrder)}
        onClose={() => {
          if (cancelOrdersMutation.isPending) {
            return;
          }

          setPendingCancelOrder(null);
          setCancelReason('');
        }}
        title="Estás por cancelar"
      >
        {pendingCancelOrder ? (
          <div className="space-y-6">
            <div className="inline-flex w-full items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Recuerda que hacer esto afecta tu reputación.</span>
            </div>

            <p className="text-sm leading-6 text-ink/70">
              Al cancelarla, se va a revertir la operación en Eselink. Si luego quieres reflejar un
              motivo interno distinto, podemos guardarlo también.
            </p>

            <div className="grid grid-cols-[64px_minmax(0,1fr)_auto_auto] items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
              {normalizeImageUrl(pendingCancelOrder.productImageUrl) ? (
                <img
                  src={normalizeImageUrl(pendingCancelOrder.productImageUrl)!}
                  alt={pendingCancelOrder.productTitle ?? 'Producto de la orden'}
                  className="h-16 w-16 rounded-2xl object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">
                  Sin foto
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-night">
                  {pendingCancelOrder.productTitle ?? 'Producto sin título'}
                </p>
                <p className="mt-1 text-xs text-ink/50">
                  {pendingCancelOrder.packId
                    ? `Pack ${pendingCancelOrder.packId}`
                    : pendingCancelOrder.orderNumber}
                </p>
              </div>
              <div className="text-sm font-medium text-ink/55">
                {formatCurrency(Number(pendingCancelOrder.totalAmount), pendingCancelOrder.currency)}
              </div>
              <div className="text-sm font-medium text-ink/55">
                {(pendingCancelOrder.individualOrders?.length ?? pendingCancelOrder.totalUnits ?? 1)} u.
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-sm font-semibold text-night">¿Cuál es el motivo de tu decisión?</p>
              <div className="space-y-3">
                {CANCEL_REASON_OPTIONS.map((reason) => (
                  <label
                    key={reason}
                    className="flex cursor-pointer items-center gap-3 text-sm text-ink/75"
                  >
                    <input
                      type="radio"
                      name="cancel-reason"
                      value={reason}
                      checked={cancelReason === reason}
                      onChange={() => setCancelReason(reason)}
                      className="h-4 w-4 border-slate-300 text-night focus:ring-night/20"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setPendingCancelOrder(null);
                  setCancelReason('');
                }}
                disabled={cancelOrdersMutation.isPending}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-ink/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={confirmCancelOrder}
                disabled={!cancelReason || cancelOrdersMutation.isPending}
                className="rounded-xl border border-rose-300/80 bg-rose-50/90 px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {cancelOrdersMutation.isPending ? 'Cancelando...' : 'Cancelar orden'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
