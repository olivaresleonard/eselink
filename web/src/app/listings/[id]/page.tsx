import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell } from '../../../components/page-shell';
import { ApiError, fetchApi, formatCurrency } from '../../../lib/api';
import { formatChannelDisplayLabel } from '../../../lib/channel-labels';

type ListingDetail = {
  id: string;
  title: string;
  externalSku?: string | null;
  externalListingId?: string | null;
  price?: string | null;
  currency: string;
  stock?: number | null;
  status: string;
  product?: { title: string } | null;
  variant?: { sku: string } | null;
  account?: { name: string } | null;
  channel?: { name: string; countryCode?: string | null } | null;
  syncLogs?: Array<{
    id: string;
    action: string;
    level: string;
    message: string;
    createdAt: string;
  }>;
};

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let listing: ListingDetail;

  try {
    listing = await fetchApi<ListingDetail>(`/listings/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }

  return (
    <PageShell
      title={`Listing ${listing.externalListingId ?? listing.id.slice(0, 8)}`}
      description="Detalle operativo de una publicación externa enlazada a un producto interno."
      actionLabel="Volver a publicaciones"
    >
      <section className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <article className="rounded-[2rem] border border-[var(--stroke)] bg-[var(--panel-strong)] p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.28em] text-sky">
            Producto interno
          </p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-night">
            {listing.product?.title ?? listing.title}
          </h2>
          <p className="mt-2 text-sm text-ink/55">
            SKU: {listing.variant?.sku ?? listing.externalSku ?? 'Sin SKU'}
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Info
              label="Canal"
              value={
                formatChannelDisplayLabel({
                  channelName: listing.channel?.name ?? null,
                  countryCode: listing.channel?.countryCode ?? null,
                  platform: listing.channel?.name?.toLowerCase().includes('mercado libre')
                    ? 'mercadolibre'
                    : null,
                }) ||
                'Sin canal'
              }
            />
            <Info label="Cuenta" value={listing.account?.name ?? 'Sin cuenta'} />
            <Info label="External Listing ID" value={listing.externalListingId ?? 'Pendiente'} />
            <Info
              label="Precio"
              value={formatCurrency(Number(listing.price ?? 0), listing.currency)}
            />
            <Info label="Stock" value={`${listing.stock ?? 0} unidades`} />
            <Info label="Estado" value={listing.status} />
          </div>
        </article>

        <article className="rounded-[2rem] border border-[var(--stroke)] bg-[var(--panel-strong)] p-6 shadow-panel">
          <p className="text-xs uppercase tracking-[0.28em] text-sky">
            Historial de sincronización
          </p>
          <div className="mt-5 space-y-4">
            {listing.syncLogs && listing.syncLogs.length > 0 ? (
              listing.syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-[1.25rem] border border-black/5 bg-white p-4"
                >
                  <p className="text-sm font-semibold text-night">{log.message}</p>
                  <p className="mt-1 text-xs text-ink/45">
                    {log.action} · {log.level} ·{' '}
                    {new Date(log.createdAt).toLocaleString('es-CL')}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[1.25rem] border border-black/5 bg-white p-4">
                <p className="text-sm text-ink/55">
                  Todavía no hay eventos de sincronización para esta publicación.
                </p>
              </div>
            )}
          </div>

          <Link
            href="/listings"
            className="mt-6 inline-flex text-sm font-semibold text-sky hover:text-night"
          >
            Volver a la tabla de publicaciones
          </Link>
        </article>
      </section>
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-black/5 bg-white p-4">
      <p className="text-xs uppercase tracking-[0.24em] text-ink/40">{label}</p>
      <p className="mt-2 text-sm font-semibold text-night">{value}</p>
    </div>
  );
}
