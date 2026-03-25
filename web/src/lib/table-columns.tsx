import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import type { ConnectedAccount, OrderRow } from '../types/eselink';
import { useState, type ReactNode } from 'react';
import { PlatformBadge, PlatformLogo } from '../components/platform-brand';

function formatMoney(value: number, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeImageUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  return url.startsWith('http://') ? `https://${url.slice('http://'.length)}` : url;
}

function ProductThumb({
  url,
  alt,
  sizeClassName = 'h-12 w-12',
}: {
  url?: string | null;
  alt: string;
  sizeClassName?: string;
}) {
  const imageUrl = normalizeImageUrl(url);

  if (!imageUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink/40 ${sizeClassName}`}
      >
        Sin foto
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={`${sizeClassName} rounded-2xl object-cover ring-1 ring-slate-200`}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?:
    | 'neutral'
    | 'positive'
    | 'warning'
    | 'danger'
    | 'info'
    | 'successSoft'
    | 'accent'
    | 'orange';
}) {
  const tones = {
    neutral: 'border border-slate-300 bg-slate-100 text-slate-700',
    positive: 'border border-emerald-300 bg-emerald-50 text-emerald-800',
    warning: 'border border-amber-300 bg-amber-100 text-amber-800',
    danger: 'border border-rose-300 bg-rose-100 text-rose-800',
    info: 'border border-blue-200 bg-blue-50 text-blue-700',
    successSoft: 'border border-emerald-200 bg-emerald-100 text-emerald-900',
    accent: 'border border-violet-200 bg-violet-50 text-violet-700',
    orange: 'border border-orange-300 bg-orange-50 text-orange-800',
  } as const;

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize tracking-[0.01em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function formatOrderStatus(status: string) {
  const labels: Record<string, string> = {
    paid: 'Pagada',
    packed: 'Preparada',
    shipped: 'Enviada',
    delivered: 'Entregada',
    cancelled: 'Cancelada',
  };

  return labels[status] ?? status;
}

function getOrderStatusTone(status: string): 'positive' | 'info' | 'warning' | 'danger' {
  if (status === 'paid') {
    return 'positive';
  }

  if (status === 'packed' || status === 'shipped') {
    return 'info';
  }

  if (status === 'cancelled') {
    return 'danger';
  }

  return 'warning';
}

function formatOrderIdentifier(orderNumber: string) {
  return orderNumber.replace(/^ML-/, '');
}

function formatGroupIdentifier(orderNumber?: string | null, packId?: string | null) {
  if (packId) {
    return packId;
  }

  if (orderNumber) {
    return formatOrderIdentifier(orderNumber);
  }

  return 'Venta';
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

function isFlexRescheduledOrder(
  order: Pick<OrderTableRow, 'shippingType' | 'shippingStage' | 'shippingSubstatus'>,
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

function isRowInTransit(row: OrderTableRow) {
  const custodySubstatuses = ['in_hub', 'in_packing_list', 'picked_up', 'dropped_off'];
  const finalizedStages = ['delivered', 'cancelled'];

  if (finalizedStages.includes(row.shippingStage ?? '') || isFlexRescheduledOrder(row)) {
    return false;
  }

  if (
    row.shippingStage === 'shipped' ||
    row.shippingStatus === 'shipped' ||
    row.status === 'shipped' ||
    custodySubstatuses.includes(row.shippingSubstatus?.toLowerCase() ?? '')
  ) {
    return true;
  }

  return (row.individualOrders ?? []).some(
    (order) =>
      !isFlexRescheduledOrder(order) &&
      !finalizedStages.includes(order.shippingStage ?? '') &&
      (order.shippingStage === 'shipped' ||
        order.shippingStatus === 'shipped' ||
        order.status === 'shipped' ||
        custodySubstatuses.includes(order.shippingSubstatus?.toLowerCase() ?? '')),
  );
}

function isRowFinalized(row: OrderTableRow) {
  const finalizedStages = ['delivered', 'cancelled', 'rescheduled'];

  if (
    finalizedStages.includes(row.shippingStage ?? '') ||
    finalizedStages.includes(row.shippingStatus ?? '') ||
    finalizedStages.includes(row.status ?? '')
  ) {
    return true;
  }

  return (row.individualOrders ?? []).some(
    (order) =>
      finalizedStages.includes(order.shippingStage ?? '') ||
      finalizedStages.includes(order.shippingStatus ?? '') ||
      finalizedStages.includes(order.status ?? ''),
  );
}

function hasPrintedLabel(row: OrderTableRow) {
  if (row.shippingSubstatus?.toLowerCase() === 'printed') {
    return true;
  }

  return (row.individualOrders ?? []).some(
    (order) => order.shippingSubstatus?.toLowerCase() === 'printed',
  );
}

function Chevron({
  open,
}: {
  open: boolean;
}) {
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-white text-sky transition ${
        open ? 'rotate-180' : ''
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path
          d="M5 12.5L10 7.5L15 12.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function ShippingIcon({
  shippingType,
}: {
  shippingType?: 'flex' | 'mercado_envios' | null;
}) {
  if (!shippingType) {
    return null;
  }

  if (shippingType === 'flex') {
    return (
      <span title="Envío Flex" className="text-[11px] font-semibold italic tracking-[0.01em] text-ink/60">
        <span className="text-[11px] font-semibold tracking-[0.01em]">Flex</span>
      </span>
    );
  }

  return (
    <span
      title="Mercado Envíos"
      className="text-[11px] font-semibold italic tracking-[0.01em] text-ink/60"
    >
      <span className="text-[11px] font-semibold tracking-[0.01em]">M. Envíos</span>
    </span>
  );
}

function MessageIndicator({
  unreadCount = 0,
  compact = false,
}: {
  unreadCount?: number;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 font-semibold text-amber-800 ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      }`}
      title={
        unreadCount > 0
          ? `${unreadCount} mensaje${unreadCount === 1 ? '' : 's'} sin leer`
          : 'La venta tiene mensajes'
      }
    >
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-3.5 w-3.5">
        <path
          d="M4.167 5.833A2.5 2.5 0 0 1 6.667 3.333h6.666a2.5 2.5 0 0 1 2.5 2.5v4.334a2.5 2.5 0 0 1-2.5 2.5H9.57l-3.086 2.468a.5.5 0 0 1-.817-.39v-2.078a2.5 2.5 0 0 1-1.5-2.287V5.833Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{unreadCount > 0 ? unreadCount : 'Msg'}</span>
    </span>
  );
}

export function formatShippingStage(
  stage?:
    | 'ready_to_print'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'rescheduled'
    | null,
) {
  if (stage === 'ready_to_print') {
    return 'Por imprimir';
  }

  if (stage === 'ready_to_ship') {
    return 'Por despachar';
  }

  if (stage === 'shipped') {
    return 'En tránsito';
  }

  if (stage === 'delivered') {
    return 'Entregada';
  }

  if (stage === 'cancelled') {
    return 'Cancelada';
  }

  if (stage === 'rescheduled') {
    return 'Reprogramada';
  }

  return null;
}

function isDeliveredLateRow(
  row: Pick<OrderTableRow, 'shippingDeliveredLate' | 'individualOrders'>,
) {
  if (row.shippingDeliveredLate) {
    return true;
  }

  return (row.individualOrders ?? []).some((order) => order.shippingDeliveredLate);
}

export function getShippingStageTone(
  stage?:
    | 'ready_to_print'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'rescheduled'
    | null,
) :
  | 'warning'
  | 'info'
  | 'positive'
  | 'neutral'
  | 'danger'
  | 'successSoft'
  | 'accent'
  | 'orange' {
  if (stage === 'ready_to_print') {
    return 'warning';
  }

  if (stage === 'ready_to_ship') {
    return 'info';
  }

  if (stage === 'shipped') {
    return 'info';
  }

  if (stage === 'delivered') {
    return 'successSoft';
  }

  if (stage === 'cancelled') {
    return 'neutral';
  }

  if (stage === 'rescheduled') {
    return 'orange';
  }

  return 'neutral';
}

function OrderLineCard({
  order,
}: {
  order: NonNullable<OrderTableRow['individualOrders']>[number];
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white px-3 py-3 shadow-sm">
      <div className="grid grid-cols-[52px_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
        <div className="row-span-2 self-stretch">
          <ProductThumb
            url={order.productImageUrl}
            alt={order.productTitle ?? 'Producto de la orden'}
            sizeClassName="h-full min-h-[64px] w-[52px]"
          />
        </div>
        <p
          className="min-w-0 truncate whitespace-nowrap text-sm text-ink/80"
          title={order.productTitle ?? 'Producto sin título'}
        >
          {order.productTitle ?? 'Producto sin título'}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink/50">
          <p>Total {new Intl.NumberFormat('es-CL').format(order.totalAmount)}</p>
          {Number(order.totalUnits ?? 0) > 0 ? (
            <p>
              · {order.totalUnits} {order.totalUnits === 1 ? 'unidad' : 'unidades'}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProductGroupCell({
  row,
}: {
  row: OrderTableRow;
}) {
  const productCount = row.individualOrders?.length ?? 1;
  const hasMultipleOrders = (row.individualOrders?.length ?? 0) > 1;
  const summaryLabel =
    productCount > 1
      ? `${productCount} productos para la venta`
      : row.productTitle ?? 'Producto sin título';
  const remainingOrders = row.individualOrders?.slice(1) ?? [];

  if (!hasMultipleOrders) {
    return (
      <div className="min-w-[280px]">
        <div className="flex items-center gap-3">
          <ProductThumb
            url={row.productImageUrl}
            alt={row.productTitle ?? 'Producto de la orden'}
          />
          <p className="font-semibold text-night">
            {row.productTitle ?? 'Producto sin título'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-[280px] rounded-[1.4rem] border border-black/10 bg-white/75 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex -space-x-3">
          <div className="rounded-2xl border-2 border-white bg-white shadow-sm">
            <ProductThumb
              url={row.productImageUrl}
              alt={row.productTitle ?? 'Producto de la orden'}
            />
          </div>
          {remainingOrders.slice(0, 2).map((order, index) => (
            <div
              key={order.externalOrderId}
              className="rounded-2xl border-2 border-white bg-white shadow-sm"
              style={{ zIndex: remainingOrders.length - index }}
            >
              <ProductThumb
                url={order.productImageUrl}
                alt={order.productTitle ?? 'Producto de la orden'}
              />
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-night">{summaryLabel}</p>
          <p className="mt-1 text-xs text-ink/45">
            El detalle de órdenes se muestra en la columna Orden
          </p>
        </div>
      </div>
    </div>
  );
}

function OrderGroupCell({
  row,
  onOpenSummary,
}: {
  row: OrderTableRow;
  onOpenSummary: (row: OrderTableRow) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const primaryIdentifier = formatGroupIdentifier(row.orderNumber, row.packId);
  const orders = row.individualOrders ?? [];
  const hasMultipleOrders = orders.length > 1;
  const identifier = row.packId ? row.packId : formatOrderIdentifier(row.orderNumber);

  if (!hasMultipleOrders) {
    return (
      <div className="min-w-[320px]">
        <button
          type="button"
          onClick={() => onOpenSummary(row)}
          className="grid w-full grid-cols-[52px_minmax(0,1fr)] items-start gap-x-3 gap-y-1 text-left transition hover:opacity-95"
        >
          <div className="row-span-3 self-stretch">
            <ProductThumb
              url={row.productImageUrl}
              alt={row.productTitle ?? 'Producto de la orden'}
              sizeClassName="h-full min-h-[64px] w-[52px]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex min-w-0 items-center gap-2">
              <PlatformLogo platform={row.platform} className="h-4 w-4 shrink-0" />
              <p className="truncate text-sm font-semibold text-night">
                {identifier}
              </p>
            </div>
            {formatPurchaseTime(row.placedAt ?? row.createdAt) ? (
              <span className="text-xs font-medium text-ink/45">
                {formatPurchaseTime(row.placedAt ?? row.createdAt)}
              </span>
            ) : null}
            {row.hasMessages ? (
              <MessageIndicator unreadCount={row.unreadMessagesCount ?? 0} compact />
            ) : null}
          </div>
          {row.account ? (
            <p className="text-xs text-ink/45">{row.account}</p>
          ) : (
            <div />
          )}
          <p
            className="max-w-[290px] min-w-0 truncate whitespace-nowrap text-sm text-ink/80"
            title={row.productTitle ?? 'Producto sin título'}
          >
            {row.productTitle ?? 'Producto sin título'}
          </p>
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-[380px] space-y-2">
      {!isOpen ? (
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOpen(true);
            }}
            className="pt-1"
            aria-label="Expandir venta"
          >
            <div>
              <Chevron open={false} />
            </div>
          </button>
          <button
            type="button"
            onClick={() => onOpenSummary(row)}
            className="flex min-w-0 flex-1 items-start gap-3 text-left transition hover:opacity-95"
          >
              <div className="flex -space-x-3 pt-0.5">
                {orders.slice(-3).map((order, index) => (
                  <div
                    key={order.externalOrderId}
                    className="rounded-2xl border-2 border-white bg-white shadow-sm"
                    style={{ zIndex: 20 + index }}
                  >
                    <ProductThumb
                      url={order.productImageUrl}
                      alt={order.productTitle ?? 'Producto de la orden'}
                    />
                  </div>
                ))}
                {orders.length > 3 ? (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-white bg-night text-xs font-semibold text-white shadow-sm">
                    +{orders.length - 3}
                  </div>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex min-w-0 items-center gap-2">
                    <PlatformLogo platform={row.platform} className="h-4 w-4 shrink-0" />
                    <p className="truncate text-sm font-semibold text-night">{primaryIdentifier}</p>
                  </div>
                  {formatPurchaseTime(row.placedAt ?? row.createdAt) ? (
                    <span className="text-xs font-medium text-ink/45">
                      {formatPurchaseTime(row.placedAt ?? row.createdAt)}
                    </span>
                  ) : null}
                  {row.hasMessages ? (
                    <MessageIndicator unreadCount={row.unreadMessagesCount ?? 0} compact />
                  ) : null}
                </div>
                {row.account ? (
                  <p className="mt-1 text-xs text-ink/45">{row.account}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <p className="text-xs text-ink/45">Venta con varias órdenes</p>
                </div>
              </div>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="px-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setIsOpen(false);
                }}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink/65 transition hover:border-sky/30 hover:text-sky"
              >
                <Chevron open />
                Contraer
              </button>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => onOpenSummary(row)}
                  className="flex flex-wrap items-center gap-2 text-left transition hover:opacity-95"
                >
                  <div className="inline-flex min-w-0 items-center gap-2">
                    <PlatformLogo platform={row.platform} className="h-4 w-4 shrink-0" />
                    <p className="truncate text-sm font-semibold text-night">{primaryIdentifier}</p>
                  </div>
                  {formatPurchaseTime(row.placedAt ?? row.createdAt) ? (
                    <span className="text-xs font-medium text-ink/45">
                      {formatPurchaseTime(row.placedAt ?? row.createdAt)}
                    </span>
                  ) : null}
                  {row.hasMessages ? (
                    <MessageIndicator unreadCount={row.unreadMessagesCount ?? 0} compact />
                  ) : null}
                </button>
                {row.account ? (
                  <p className="mt-1 text-xs text-ink/45">{row.account}</p>
                ) : null}
              </div>
            </div>
          </div>
          <div className="divide-y divide-black/10 overflow-hidden rounded-2xl bg-transparent">
            {orders.map((order) => (
              <div key={order.externalOrderId} className="py-2 first:pt-0 last:pb-0">
                <OrderLineCard order={order} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderActionsMenu({
  row,
  onPrintLabel,
  isPrinting,
  isOpen,
  onToggle,
}: {
  row: OrderTableRow;
  onPrintLabel: (row: OrderTableRow) => void | Promise<void>;
  isPrinting: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const printedLabel = hasPrintedLabel(row);
  const inTransit = isRowInTransit(row);
  const finalized = isRowFinalized(row);
  const isPrintBlocked = inTransit || finalized;
  const printActionLabel = printedLabel ? 'Reimprimir etiqueta' : 'Imprimir etiqueta';
  const printActionHint = isPrinting ? '...' : isPrintBlocked ? 'Bloq.' : 'PDF';

  async function copyIdentifier() {
    try {
      await navigator.clipboard.writeText(row.packId ?? row.orderNumber);
    } catch {
      // Keep the row action usable even if clipboard permissions are unavailable.
    }
  }

  return (
    <div className="relative">
      <summary
        aria-label="Abrir acciones"
        onClick={onToggle}
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-black/10 bg-white text-ink/70 transition hover:border-sky/20 hover:text-sky"
      >
        {row.hasMessages ? (
          <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" />
        ) : null}
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className="h-4 w-4"
        >
          <path d="M10 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
        </svg>
      </summary>
      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-[190px] rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
          <button
            type="button"
            onClick={() => void onPrintLabel(row)}
            disabled={isPrinting || isPrintBlocked}
            title={
              finalized
                ? 'La venta ya esta finalizada y no permite impresion de etiqueta.'
                : inTransit
                  ? 'El envio ya esta en transito y no permite impresion de etiqueta.'
                  : undefined
            }
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-ink/80 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{printActionLabel}</span>
            <span className="text-xs text-ink/45">{printActionHint}</span>
          </button>
          <button
            type="button"
            onClick={() => void copyIdentifier()}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-ink/80 transition hover:bg-slate-50"
          >
            <span>{row.packId ? 'Copiar pack' : 'Copiar orden'}</span>
            <span className="text-xs text-ink/45">
              {row.packId ?? formatOrderIdentifier(row.orderNumber)}
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export type OrderTableRow = OrderRow & {
  account?: string;
  isNew?: boolean;
  productTitle?: string | null;
  productImageUrl?: string | null;
  packId?: string | null;
  profitAmount?: number | null;
  hasMessages?: boolean;
  unreadMessagesCount?: number;
  lastMessageText?: string | null;
  lastMessageCreatedAt?: string | null;
  shippingDeliveredLate?: boolean;
  individualOrders?: Array<{
    id: string;
    orderNumber: string;
    externalOrderId: string;
    productTitle?: string | null;
    productImageUrl?: string | null;
    shippingType?: 'flex' | 'mercado_envios' | null;
    shippingStatus?: string | null;
    shippingSubstatus?: string | null;
    shippingSlaStatus?: string | null;
    shippingExpectedDate?: string | null;
    shippingDeliveredAt?: string | null;
    shippingDeliveredLate?: boolean;
    shippingStage?:
      | 'ready_to_print'
      | 'ready_to_ship'
      | 'shipped'
      | 'delivered'
      | 'cancelled'
      | 'rescheduled'
      | null;
    status: string;
    totalAmount: number;
    totalUnits?: number | null;
    hasMessages?: boolean;
    unreadMessagesCount?: number;
  }>;
  productCards?: Array<{
    title?: string | null;
    imageUrl?: string | null;
    orderNumber: string;
    shippingType?: 'flex' | 'mercado_envios' | null;
  }>;
};

export const accountColumns: ColumnDef<ConnectedAccount>[] = [
  {
    accessorKey: 'name',
    header: 'Cuenta',
    cell: ({ row }) => (
      <div>
        <p className="font-semibold text-night">{row.original.name}</p>
        <p className="mt-1 text-xs text-ink/45">{row.original.channelId}</p>
      </div>
    ),
  },
  {
    accessorKey: 'platform',
    header: 'Plataforma',
    cell: ({ getValue }) => (
      <PlatformBadge platform={String(getValue()) as ConnectedAccount['platform']} />
    ),
  },
  { accessorKey: 'externalId', header: 'External ID' },
  {
    accessorKey: 'status',
    header: 'Estado',
    cell: ({ getValue }) => {
      const value = String(getValue());
      return (
        <StatusBadge tone={value === 'active' ? 'positive' : 'warning'}>
          {value === 'active' ? 'activa' : 'inactiva'}
        </StatusBadge>
      );
    },
  },
];

export function createOrderColumns({
  onPrintLabel,
  printingOrderId,
  onOpenSummary,
  selectedRowIds,
  onToggleRowSelection,
  onToggleAllSelection,
  isSelectable,
  allSelectableRowsSelected,
  hasSelectableRows,
  openActionMenuId,
  onToggleActionMenu,
}: {
  onPrintLabel: (row: OrderTableRow) => void | Promise<void>;
  printingOrderId?: string | null;
  onOpenSummary: (row: OrderTableRow) => void;
  selectedRowIds: Set<string>;
  onToggleRowSelection: (rowId: string) => void;
  onToggleAllSelection: () => void;
  isSelectable: (row: OrderTableRow) => boolean;
  allSelectableRowsSelected: boolean;
  hasSelectableRows: boolean;
  openActionMenuId: string | null;
  onToggleActionMenu: (rowId: string) => void;
}): ColumnDef<OrderTableRow>[] {
  return [
    {
      id: 'select',
      header: () => (
        <div className="flex justify-center">
          <input
            type="checkbox"
            checked={allSelectableRowsSelected}
            disabled={!hasSelectableRows}
            onChange={onToggleAllSelection}
            className="h-4 w-4 rounded border-black/20 text-night focus:ring-night/20 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Seleccionar todas las ventas visibles con etiqueta imprimible o reimprimible"
          />
        </div>
      ),
      cell: ({ row }) => {
        const selectable = isSelectable(row.original);

        return (
          <div className="flex justify-center pt-1">
            <input
              type="checkbox"
              checked={selectedRowIds.has(row.original.id)}
              disabled={!selectable}
              onChange={() => onToggleRowSelection(row.original.id)}
              className="h-4 w-4 rounded border-black/20 text-night focus:ring-night/20 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label={
                selectable
                  ? 'Seleccionar venta para impresion o reimpresion masiva'
                  : 'Venta sin etiqueta imprimible o reimprimible'
              }
            />
          </div>
        );
      },
    },
    {
      accessorKey: 'orderNumber',
      header: 'Orden',
      cell: ({ row }) => (
        <div className="-ml-3">
          <OrderGroupCell row={row.original} onOpenSummary={onOpenSummary} />
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const shippingStage =
          row.original.shippingStage ?? row.original.individualOrders?.[0]?.shippingStage ?? null;
        const shippingStageLabel = row.original.shippingOverdue
          ? 'Demorada'
          : isDeliveredLateRow(row.original)
            ? 'Entregada demorada'
            : formatShippingStage(shippingStage);
        const shippingStageTone = row.original.shippingOverdue
          ? 'danger'
          : isDeliveredLateRow(row.original)
            ? 'accent'
            : getShippingStageTone(shippingStage);

        return (
          <div className="flex flex-col items-center gap-2 text-center">
            {shippingStageLabel ? <StatusBadge tone={shippingStageTone}>{shippingStageLabel}</StatusBadge> : <span className="text-xs text-ink/40">Sin etapa</span>}
          </div>
        );
      },
    },
    {
      accessorKey: 'customerName',
      header: 'Cliente',
      cell: ({ row }) => {
        const customerDisplayName =
          row.original.customerDisplayName?.trim() ?? row.original.customerName?.trim();
        const customerNickname = row.original.customerNickname?.trim();
        const showNickname =
          Boolean(customerNickname) &&
          customerNickname!.toLowerCase() !== (customerDisplayName ?? '').toLowerCase();

        return (
          <div className="min-w-[160px]">
            <p className="text-sm font-medium text-night">
              {customerDisplayName || 'Cliente sin nombre'}
            </p>
            <p className="mt-1 text-xs text-ink/45">
              {showNickname
                ? customerNickname
                : row.original.packId
                  ? 'Venta agrupada'
                  : 'Venta individual'}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: 'shippingCity',
      header: 'Comuna',
      cell: ({ row }) => {
        const shippingType =
          row.original.shippingType ?? row.original.individualOrders?.[0]?.shippingType ?? null;

        return (
        <div className="min-w-[120px]">
          <p className="text-sm font-medium text-ink/80">
            {row.original.shippingCity || 'Sin comuna'}
          </p>
          <div className="mt-1 text-xs text-ink/45">
            <ShippingIcon shippingType={shippingType} />
          </div>
        </div>
        );
      },
    },
    {
      accessorKey: 'totalAmount',
      header: 'Total',
      cell: ({ row }) => (
        <div className="min-w-[112px]">
          <p className="text-sm font-semibold text-night">
            {formatMoney(row.original.totalAmount, row.original.currency)}
          </p>
          {(row.original.totalUnits ?? 0) > 0 ? (
            <p className="mt-1 text-xs text-ink/45">
              {row.original.totalUnits} {row.original.totalUnits === 1 ? 'unidad' : 'unidades'}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: 'profitAmount',
      header: 'Ganancia',
      cell: ({ row }) => {
        const profitAmount = row.original.profitAmount;

        if (profitAmount === null || profitAmount === undefined) {
          return (
            <div className="min-w-[112px]">
              <span className="text-sm text-ink/45">Sin costo</span>
            </div>
          );
        }

        return (
          <div className="min-w-[112px]">
            <span
              className={`text-sm font-semibold ${
                profitAmount >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {formatMoney(profitAmount, row.original.currency)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <OrderActionsMenu
            row={row.original}
            onPrintLabel={onPrintLabel}
            isPrinting={printingOrderId === row.original.id}
            isOpen={openActionMenuId === row.original.id}
            onToggle={() => onToggleActionMenu(row.original.id)}
          />
        </div>
      ),
    },
  ];
}

export type ProductTableRow = {
  id: string;
  variantId: string | null;
  imageUrl?: string | null;
  sku: string;
  title: string;
  internalCategory: string;
  variantType: 'none' | 'talla' | 'tamano';
  stock: number;
  purchasePrice: string;
  supplier: string;
  supplierProductAlias: string;
};

function ProductActionsMenu({
  row,
  isOpen,
  onToggle,
  onEdit,
  onDelete,
}: {
  row: ProductTableRow;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: (row: ProductTableRow) => void;
  onDelete: (row: ProductTableRow) => void;
}) {
  return (
    <div className="relative">
      <summary
        aria-label="Abrir acciones"
        onClick={onToggle}
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-xl border border-black/10 bg-white text-ink/70 transition hover:border-sky/20 hover:text-sky"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-4 w-4">
          <path d="M10 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" />
        </svg>
      </summary>
      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-[210px] rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
          <button
            type="button"
            onClick={() => onEdit(row)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-ink/80 transition hover:bg-slate-50"
          >
            <span>Editar</span>
            <span className="text-xs text-ink/45">Ficha</span>
          </button>
          <button
            type="button"
            onClick={() => onDelete(row)}
            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-ink/80 transition hover:bg-slate-50"
          >
            <span>Eliminar</span>
            <span className="text-xs text-ink/45">Borrar</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function createProductColumns({
  openActionMenuId,
  onToggleActionMenu,
  onEditProduct,
  onDeleteProduct,
}: {
  openActionMenuId: string | null;
  onToggleActionMenu: (id: string) => void;
  onEditProduct: (row: ProductTableRow) => void;
  onDeleteProduct: (row: ProductTableRow) => void;
}): ColumnDef<ProductTableRow>[] {
  return [
    {
      id: 'product',
      header: 'Producto',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <ProductThumb url={row.original.imageUrl} alt={row.original.title} />
          <div>
            <p className="font-semibold text-night">{row.original.title}</p>
            <p className="mt-1 text-xs text-ink/45">{row.original.sku}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'internalCategory',
      header: 'Categoría',
      cell: ({ getValue }) => (
        <span className={getValue() === 'Sin categoría' ? 'text-ink/40' : ''}>{String(getValue())}</span>
      ),
    },
    {
      accessorKey: 'stock',
      header: 'Stock',
      cell: ({ getValue }) => {
        const stock = Number(getValue());
        const tone = stock > 20 ? 'positive' : stock > 10 ? 'warning' : 'danger';
        return <StatusBadge tone={tone}>{String(stock)} unidades</StatusBadge>;
      },
    },
    { accessorKey: 'purchasePrice', header: 'Precio compra' },
    {
      accessorKey: 'supplier',
      header: 'Proveedor',
      cell: ({ getValue }) => (
        <span className={getValue() === 'Sin proveedor' ? 'text-ink/40' : ''}>{String(getValue())}</span>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => (
        <div className="flex justify-end">
          <ProductActionsMenu
            row={row.original}
            isOpen={openActionMenuId === row.original.id}
            onToggle={() => onToggleActionMenu(row.original.id)}
            onEdit={onEditProduct}
            onDelete={onDeleteProduct}
          />
        </div>
      ),
    },
  ];
}

export type ListingTableRow = {
  id: string;
  imageUrl?: string | null;
  product: string;
  sku: string;
  channel: string;
  account: string;
  externalListingId: string;
  price: string;
  stock: number;
  status: string;
};

export const listingColumns: ColumnDef<ListingTableRow>[] = [
  {
    accessorKey: 'product',
    header: 'Producto',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <ProductThumb url={row.original.imageUrl} alt={row.original.product} />
        <div>
          <p className="font-semibold text-night">{row.original.product}</p>
          <p className="mt-1 text-xs text-ink/45">{row.original.sku}</p>
        </div>
      </div>
    ),
  },
  { accessorKey: 'channel', header: 'Canal' },
  { accessorKey: 'account', header: 'Cuenta' },
  { accessorKey: 'price', header: 'Precio' },
  {
    accessorKey: 'stock',
    header: 'Stock',
    cell: ({ getValue }) => {
      const stock = Number(getValue());
      const tone = stock > 20 ? 'positive' : stock > 10 ? 'warning' : 'danger';
      return <StatusBadge tone={tone}>{String(stock)} unidades</StatusBadge>;
    },
  },
  {
    accessorKey: 'status',
    header: 'Estado',
    cell: ({ getValue }) => {
      const value = String(getValue());
      const tone =
        value === 'published' ? 'positive' : value === 'draft' ? 'warning' : 'danger';
      return <StatusBadge tone={tone}>{value}</StatusBadge>;
    },
  },
  {
    id: 'detail',
    header: 'Detalle',
    cell: ({ row }) => (
      <Link
        href={`/listings/${row.original.id}`}
        className="text-sm font-semibold text-sky hover:text-night"
      >
        Ver detalle
      </Link>
    ),
  },
];

export type SyncLogTableRow = {
  type: string;
  level: string;
  message: string;
  date: string;
};

export const syncLogColumns: ColumnDef<SyncLogTableRow>[] = [
  { accessorKey: 'type', header: 'Proceso' },
  {
    accessorKey: 'level',
    header: 'Nivel',
    cell: ({ getValue }) => {
      const value = String(getValue());
      const tone = value === 'info' ? 'info' : value === 'warning' ? 'warning' : 'danger';
      return <StatusBadge tone={tone}>{value}</StatusBadge>;
    },
  },
  { accessorKey: 'message', header: 'Mensaje' },
  { accessorKey: 'date', header: 'Fecha' },
];
