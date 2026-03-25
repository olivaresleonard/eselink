'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DataTable } from '../../components/data-table';
import { PageShell } from '../../components/page-shell';
import { PlatformBadge } from '../../components/platform-brand';
import { QueryState } from '../../components/query-state';
import { ApiError, deleteApi, fetchApi, patchApi } from '../../lib/api';
import { formatChannelDisplayLabel } from '../../lib/channel-labels';
import type { ConnectedAccount, PlatformCode } from '../../types/eselink';

type ApiAccount = Omit<ConnectedAccount, 'platform'>;
type ApiChannel = {
  id: string;
  name: string;
  countryCode?: string | null;
  code?: PlatformCode;
  type?: PlatformCode;
};

function resolveChannelLabel(input?: { channel?: ApiChannel; rawChannelId?: string }) {
  return formatChannelDisplayLabel({
    channelName: input?.channel?.name ?? input?.rawChannelId ?? '',
    channelId: input?.rawChannelId ?? input?.channel?.code ?? null,
    countryCode: input?.channel?.countryCode ?? null,
    platform: input?.channel?.type ?? input?.channel?.code ?? null,
  });
}

type AccountRow = ConnectedAccount & {
  rawChannelId: string;
};

function StatusBadge({
  tone,
  children,
}: {
  tone: 'positive' | 'warning' | 'danger' | 'info';
  children: ReactNode;
}) {
  const tones = {
    positive: 'border border-emerald-300 bg-emerald-50 text-emerald-800',
    warning: 'border border-amber-300 bg-amber-100 text-amber-800',
    danger: 'border border-rose-300 bg-rose-100 text-rose-800',
    info: 'border border-blue-200 bg-blue-50 text-blue-700',
  } as const;

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize tracking-[0.01em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function FeedbackToast({
  tone,
  message,
  onClose,
}: {
  tone: 'success' | 'error';
  message: string;
  onClose: () => void;
}) {
  const styles =
    tone === 'success'
      ? 'border-emerald-700 bg-emerald-700 text-white shadow-emerald-950/30'
      : 'border-rose-700 bg-rose-700 text-white shadow-rose-950/30';

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[70] w-full max-w-sm">
      <div
        className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${styles}`}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {tone === 'success' ? 'Cuenta actualizada' : 'No pudimos actualizar la cuenta'}
            </p>
            <p className="mt-1 text-sm leading-5">{message}</p>
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

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setFeedback(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['accounts-page'],
    queryFn: async () => {
      const [apiAccounts, apiChannels] = await Promise.all([
        fetchApi<ApiAccount[]>('/accounts'),
        fetchApi<ApiChannel[]>('/channels'),
      ]);
      const channelsById = new Map(apiChannels.map((channel) => [channel.id, channel]));

      return apiAccounts.map((account) => {
        const channel = channelsById.get(account.channelId);

        return {
          ...account,
          rawChannelId: account.channelId,
          channelId: resolveChannelLabel({ channel, rawChannelId: account.channelId }) || account.channelId,
          platform: channel?.type ?? channel?.code ?? 'mercadolibre',
        };
      });
    },
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ConnectedAccount['status'] }) => {
      setFeedback(null);
      return patchApi(`/accounts/${id}`, { status });
    },
    onSuccess: async (_, variables) => {
      setFeedback({
        tone: 'success',
        message:
          variables.status === 'inactive'
            ? 'La cuenta quedó desactivada y ya no entrará en las sincronizaciones automáticas.'
            : 'La cuenta volvió a quedar activa para operar y sincronizar.',
      });
      await queryClient.invalidateQueries({ queryKey: ['accounts-page'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-accounts-options'] });
    },
    onError: (mutationError) => {
      setFeedback({
        tone: 'error',
        message:
          mutationError instanceof ApiError
            ? mutationError.message
            : 'No pudimos actualizar el estado de la cuenta.',
      });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      setFeedback(null);
      return deleteApi(`/accounts/${id}`);
    },
    onSuccess: async () => {
      setFeedback({
        tone: 'success',
        message: 'La cuenta se eliminó correctamente.',
      });
      await queryClient.invalidateQueries({ queryKey: ['accounts-page'] });
      await queryClient.invalidateQueries({ queryKey: ['orders-accounts-options'] });
    },
    onError: (mutationError) => {
      setFeedback({
        tone: 'error',
        message:
          mutationError instanceof ApiError
            ? mutationError.message
            : 'No pudimos eliminar la cuenta.',
      });
    },
  });

  const accountsWithActions = data as AccountRow[];
  const pendingAccountId = changeStatus.variables?.id ?? deleteAccount.variables ?? null;

  const columns = useMemo<ColumnDef<AccountRow>[]>(
    () => [
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
          <PlatformBadge platform={String(getValue()) as PlatformCode} />
        ),
      },
      { accessorKey: 'externalId', header: 'External ID' },
      {
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const account = row.original;
          const value = account.status;
          const isBusy =
            pendingAccountId === account.id &&
            (changeStatus.isPending || deleteAccount.isPending);

          return (
            <div className="flex flex-col items-start gap-3">
              <StatusBadge
                tone={
                  value === 'active' ? 'positive' : value === 'inactive' ? 'warning' : 'danger'
                }
              >
                {value === 'active' ? 'activa' : value === 'inactive' ? 'inactiva' : 'con error'}
              </StatusBadge>
              <button
                type="button"
                role="switch"
                aria-checked={account.status === 'active'}
                aria-label={
                  account.status === 'active'
                    ? `Desactivar ${account.name}`
                    : `Activar ${account.name}`
                }
                disabled={isBusy}
                onClick={() =>
                  changeStatus.mutate({
                    id: account.id,
                    status: account.status === 'active' ? 'inactive' : 'active',
                  })
                }
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                  account.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'
                } ${isBusy ? 'cursor-wait opacity-60' : ''}`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${
                    account.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: 'Acciones',
        cell: ({ row }) => {
          const account = row.original;
          const isBusy =
            pendingAccountId === account.id &&
            (changeStatus.isPending || deleteAccount.isPending);

          return (
            <div className="flex justify-center">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  const confirmed = window.confirm(
                    `Vas a eliminar la cuenta "${account.name}". Esta acción no se puede deshacer.`,
                  );

                  if (confirmed) {
                    deleteAccount.mutate(account.id);
                  }
                }}
                className="rounded-full border border-rose-200 bg-rose-50 p-2 text-rose-700 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
                aria-label={`Eliminar ${account.name}`}
                title="Eliminar cuenta"
              >
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="M7.5 3.5H12.5M4.5 6H15.5M6 6L6.6 14.4C6.67 15.37 7.48 16.12 8.45 16.12H11.55C12.52 16.12 13.33 15.37 13.4 14.4L14 6M8.5 8.5V13M11.5 8.5V13"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          );
        },
      },
    ],
    [changeStatus, deleteAccount, pendingAccountId],
  );

  return (
    <PageShell
      title="Cuentas conectadas"
      description="Consulta las cuentas ya operativas en tu workspace. La conexión y autenticación inicial ahora vive en Integraciones."
      actionContent={
        <Link
          href="/integrations"
          className="rounded-2xl bg-gradient-to-r from-moss to-aurora px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-moss/20 transition hover:scale-[1.01]"
        >
          Ir a integraciones
        </Link>
      }
    >
        {isLoading ? (
          <QueryState
            title="Cargando cuentas"
            description="Estamos consultando las cuentas conectadas y sus canales."
          />
        ) : isError ? (
          <QueryState
            title="No pudimos cargar cuentas"
            description="La API respondió con error o la red se interrumpió."
          />
        ) : (
          <div className="space-y-4">
            <DataTable
              data={accountsWithActions}
              columns={columns}
              title="Cuentas"
              description="Activa, pausa o elimina cuentas conectadas de tu workspace"
              searchPlaceholder="Buscar cuenta o plataforma"
            />
          </div>
        )}
        {feedback ? (
          <FeedbackToast
            tone={feedback.tone}
            message={feedback.message}
            onClose={() => setFeedback(null)}
          />
        ) : null}
    </PageShell>
  );
}
