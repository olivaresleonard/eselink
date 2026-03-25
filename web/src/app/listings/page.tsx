'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { DataTable } from '../../components/data-table';
import {
  FieldGroup,
  FormActions,
  FormMessage,
  inputClassName,
} from '../../components/form-field';
import { Modal } from '../../components/modal';
import { PageShell } from '../../components/page-shell';
import { QueryState } from '../../components/query-state';
import { ApiError, fetchApi, formatCurrency, postApi } from '../../lib/api';
import { formatChannelDisplayLabel } from '../../lib/channel-labels';
import { listingColumns } from '../../lib/table-columns';

type ApiListing = {
  id: string;
  title: string;
  productId: string;
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
  metadata?: {
    thumbnail?: string | null;
    pictures?: Array<{ url?: string | null }> | null;
  } | null;
};

type ApiVariant = {
  id: string;
  sku: string;
  title?: string | null;
};

type ApiAccount = {
  id: string;
  name: string;
};

const initialForm = {
  productVariantId: '',
  accountId: '',
  price: 0,
  stock: 0,
};

export default function ListingsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);

  const { data: variants = [] } = useQuery({
    queryKey: ['listings-variants-options'],
    queryFn: () => fetchApi<ApiVariant[]>('/product-variants'),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['listings-accounts-options'],
    queryFn: () => fetchApi<ApiAccount[]>('/accounts'),
  });

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['listings-page'],
    queryFn: async () => {
      const apiListings = await fetchApi<ApiListing[]>('/listings');

      return apiListings.map((listing) => ({
        id: listing.id,
        imageUrl: listing.metadata?.thumbnail ?? listing.metadata?.pictures?.[0]?.url ?? null,
        product: listing.product?.title ?? listing.title,
        sku: listing.variant?.sku ?? listing.externalSku ?? 'Sin SKU',
        channel:
          formatChannelDisplayLabel({
            channelName: listing.channel?.name ?? null,
            countryCode: listing.channel?.countryCode ?? null,
            platform: listing.channel?.name?.toLowerCase().includes('mercado libre')
              ? 'mercadolibre'
              : null,
          }) || 'Sin canal',
        account: listing.account?.name ?? 'Sin cuenta',
        externalListingId: listing.externalListingId ?? 'Pendiente',
        price: formatCurrency(Number(listing.price ?? 0), listing.currency),
        stock: listing.stock ?? 0,
        status: listing.status,
      }));
    },
  });

  const publishListing = useMutation({
    mutationFn: async () => {
      setError(null);

      await postApi('/listings/publish', {
        product_variant_id: form.productVariantId,
        account_ids: [form.accountId],
        price: form.price,
        stock: form.stock,
      });
    },
    onSuccess: async () => {
      setIsOpen(false);
      setForm(initialForm);
      await queryClient.invalidateQueries({ queryKey: ['listings-page'] });
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'No pudimos publicar el listing.',
      );
    },
  });

  const variantOptions = useMemo(
    () =>
      variants.map((variant) => ({
        value: variant.id,
        label: `${variant.sku} · ${variant.title ?? 'Variante'}`,
      })),
    [variants],
  );

  const accountOptions = useMemo(
    () => accounts.map((account) => ({ value: account.id, label: account.name })),
    [accounts],
  );

  useEffect(() => {
    if (accountOptions.length !== 1) {
      return;
    }

    const onlyAccount = accountOptions[0]!.value;
    setForm((current) => (current.accountId === onlyAccount ? current : { ...current, accountId: onlyAccount }));
  }, [accountOptions]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    publishListing.mutate();
  }

  function openModal() {
    setError(null);
    setForm({
      productVariantId: variants[0]?.id ?? '',
      accountId: accounts[0]?.id ?? '',
      price: 0,
      stock: 0,
    });
    setIsOpen(true);
  }

  return (
    <>
      <PageShell
        title="Publicaciones"
        description="Visualiza el estado de tus publicaciones por canal para detectar borradores, pausas y oportunidades de activación."
        actionContent={
          <button
            type="button"
            onClick={openModal}
            disabled={variantOptions.length === 0 || accountOptions.length === 0}
            className="rounded-2xl bg-gradient-to-r from-moss to-aurora px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-moss/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Nueva publicación
          </button>
        }
      >
        {isLoading ? (
          <QueryState
            title="Cargando publicaciones"
            description="Estamos consultando el estado real de tus listings."
          />
        ) : isError ? (
          <QueryState
            title="No pudimos cargar publicaciones"
            description="La consulta falló antes de renderizar la tabla."
          />
        ) : (
          <DataTable
            data={data}
            columns={listingColumns}
            title="Estado por canal"
            description="Publicaciones visibles, en borrador o pausadas"
            searchPlaceholder="Buscar canal o producto"
          />
        )}
      </PageShell>

      <Modal
        open={isOpen}
        onClose={() => !publishListing.isPending && setIsOpen(false)}
        title="Publicar listing"
        description="Selecciona la variante, la cuenta destino y los datos obligatorios para disparar la publicación."
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldGroup label="Variante" required>
              <select
                required
                value={form.productVariantId}
                onChange={(event) =>
                  setForm({ ...form, productVariantId: event.target.value })
                }
                className={inputClassName()}
              >
                <option value="">Selecciona una variante</option>
                {variantOptions.map((variant) => (
                  <option key={variant.value} value={variant.value}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Cuenta" required>
              <select
                required
                value={form.accountId}
                onChange={(event) => setForm({ ...form, accountId: event.target.value })}
                disabled={accountOptions.length === 1}
                className={inputClassName()}
              >
                {accountOptions.length !== 1 ? <option value="">Selecciona una cuenta</option> : null}
                {accountOptions.map((account) => (
                  <option key={account.value} value={account.value}>
                    {account.label}
                  </option>
                ))}
              </select>
            </FieldGroup>

            <FieldGroup label="Precio" required>
              <input
                required
                min={0}
                type="number"
                value={form.price}
                onChange={(event) =>
                  setForm({ ...form, price: Number(event.target.value) })
                }
                className={inputClassName()}
                placeholder="19990"
              />
            </FieldGroup>

            <FieldGroup label="Stock" required>
              <input
                required
                min={0}
                type="number"
                value={form.stock}
                onChange={(event) =>
                  setForm({ ...form, stock: Number(event.target.value) })
                }
                className={inputClassName()}
                placeholder="10"
              />
            </FieldGroup>
          </div>

          {error ? <FormMessage>{error}</FormMessage> : null}
          <FormActions
            submitLabel="Publicar"
            submitting={publishListing.isPending}
            onCancel={() => setIsOpen(false)}
          />
        </form>
      </Modal>
    </>
  );
}
