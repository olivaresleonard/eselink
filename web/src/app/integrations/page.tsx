'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FieldGroup,
  FormActions,
  FormMessage,
  inputClassName,
} from '../../components/form-field';
import { PageShell } from '../../components/page-shell';
import { QueryState } from '../../components/query-state';
import { ApiError, fetchApi, postApi } from '../../lib/api';
import type { ConnectedAccount, PlatformCode } from '../../types/eselink';

type ApiAccount = Omit<ConnectedAccount, 'platform'>;
type ApiChannel = {
  id: string;
  name: string;
  code?: PlatformCode;
  type?: PlatformCode;
};

type OAuthStartResponse = {
  url: string;
  state: string;
};

const initialForm = {
  name: '',
  channelId: '',
  externalId: '',
  accessToken: '',
  refreshToken: '',
  status: 'active',
  currency: 'CLP',
};

function IntegrationsPageContent() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const oauthStatus = searchParams.get('oauth');
  const oauthAccount = searchParams.get('account');
  const oauthMessage = searchParams.get('message');

  const oauthFeedback = useMemo(() => {
    if (oauthStatus === 'success') {
      return {
        tone: 'success' as const,
        title: 'Cuenta conectada correctamente',
        description: oauthAccount
          ? `${oauthAccount} ya quedó lista para usarse en Cuentas.`
          : 'La integración quedó lista para usarse en Cuentas.',
      };
    }

    if (oauthStatus === 'error') {
      return {
        tone: 'error' as const,
        title: 'No pudimos completar la conexión',
        description: oauthMessage ?? 'La autorización no terminó correctamente.',
      };
    }

    return null;
  }, [oauthAccount, oauthMessage, oauthStatus]);

  const { data: channels = [], isLoading, isError } = useQuery({
    queryKey: ['integrations-page-channels'],
    queryFn: () => fetchApi<ApiChannel[]>('/channels'),
  });

  const createAccount = useMutation({
    mutationFn: async () => {
      setError(null);

      await postApi('/accounts', {
        name: form.name,
        channelId: form.channelId,
        externalId: form.externalId || undefined,
        accessToken: form.accessToken || undefined,
        refreshToken: form.refreshToken || undefined,
        status: form.status,
        currency: form.currency || undefined,
      });
    },
    onSuccess: async () => {
      setForm((current) => ({
        ...initialForm,
        channelId: current.channelId,
      }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['accounts-page'] }),
        queryClient.invalidateQueries({ queryKey: ['integrations-page-channels'] }),
      ]);
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'No pudimos conectar la integración.',
      );
    },
  });

  const startMercadoLibreOAuth = useMutation({
    mutationFn: async () => {
      setError(null);
      return postApi<OAuthStartResponse>('/account-connections/mercadolibre/oauth/start');
    },
    onSuccess: (payload) => {
      window.open(payload.url, '_blank', 'noopener,noreferrer');
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError
          ? mutationError.message
          : 'No pudimos iniciar la conexión con Mercado Libre.',
      );
    },
  });

  const channelOptions = useMemo(
    () =>
      channels.map((channel) => ({
        value: channel.id,
        label: `${channel.name} (${channel.type ?? channel.code ?? 'canal'})`,
      })),
    [channels],
  );

  useEffect(() => {
    if (channelOptions.length !== 1) {
      return;
    }

    const onlyChannel = channelOptions[0]!.value;
    setForm((current) =>
      current.channelId === onlyChannel ? current : { ...current, channelId: onlyChannel },
    );
  }, [channelOptions]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createAccount.mutate();
  }

  return (
    <PageShell
      title="Integraciones"
      description="Conecta nuevos canales y resuelve la autenticación técnica antes de operar las cuentas desde el módulo de Cuentas."
    >
      {isLoading ? (
        <QueryState
          title="Cargando integraciones"
          description="Estamos buscando los canales disponibles para conectar."
        />
      ) : isError ? (
        <QueryState
          title="No pudimos cargar integraciones"
          description="Revisa la API e inténtalo nuevamente."
        />
      ) : (
        <div className="space-y-5">
          {oauthFeedback ? (
            <section
              className={`rounded-[2rem] border px-6 py-5 shadow-panel backdrop-blur-xl ${
                oauthFeedback.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50/90'
                  : 'border-rose-200 bg-rose-50/90'
              }`}
            >
              <p
                className={`text-xs uppercase tracking-[0.24em] ${
                  oauthFeedback.tone === 'success' ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {oauthFeedback.tone === 'success' ? 'Integración lista' : 'Conexión incompleta'}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-night">
                {oauthFeedback.title}
              </h2>
              <p className="mt-2 text-sm text-ink/70">{oauthFeedback.description}</p>
              {oauthFeedback.tone === 'success' ? (
                <p className="mt-3 text-sm text-ink/60">
                  Puedes volver a la app o cerrar la pestaña de autorización.
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[2rem] border border-[var(--stroke)] bg-[var(--panel-strong)] p-6 shadow-panel backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.24em] text-sky">Flujo</p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-night">
              Conecta primero, opera después
            </h2>
            <div className="mt-5 space-y-4">
              <div className="rounded-[1.5rem] border border-white/60 bg-white/80 px-4 py-4">
                <p className="text-sm font-semibold text-night">1. Elige el canal</p>
                <p className="mt-1 text-sm text-ink/65">
                  Selecciona el proveedor que quieres conectar a tu workspace.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/60 bg-white/80 px-4 py-4">
                <p className="text-sm font-semibold text-night">2. Autoriza o registra credenciales</p>
                <p className="mt-1 text-sm text-ink/65">
                  Este módulo concentra el paso técnico de autenticación y renovación.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/60 bg-white/80 px-4 py-4">
                <p className="text-sm font-semibold text-night">3. Usa la cuenta en operación</p>
                <p className="mt-1 text-sm text-ink/65">
                  Una vez conectada, la cuenta aparece en Cuentas y en la bandeja operativa.
                </p>
              </div>
            </div>
            </section>

            <section className="rounded-[2rem] border border-[var(--stroke)] bg-[var(--panel-strong)] p-6 shadow-panel backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.24em] text-sky">Proveedores</p>
            <h2 className="mt-3 font-display text-2xl font-semibold text-night">
              Conectar integración
            </h2>
            <p className="mt-2 text-sm text-ink/65">
              Usa OAuth cuando el proveedor lo permita. El formulario manual queda como respaldo técnico mientras terminamos de mover todos los flujos aquí.
            </p>
            <div className="mt-6 grid gap-4">
              <div className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-night">Mercado Libre</p>
                    <p className="mt-1 text-sm text-ink/65">
                      Inicia OAuth para conectar una cuenta y traer publicaciones al terminar la autorización.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => startMercadoLibreOAuth.mutate()}
                      disabled={startMercadoLibreOAuth.isPending}
                      className="rounded-2xl bg-[#fff2b8] px-4 py-3 text-sm font-semibold text-[#6b5200] transition hover:brightness-[0.98] disabled:cursor-wait disabled:opacity-70"
                    >
                      {startMercadoLibreOAuth.isPending
                        ? 'Abriendo...'
                        : 'Conectar Mercado Libre'}
                    </button>
                    <p className="text-xs text-ink/55">
                      Se abre una pestaña nueva y al terminar te traemos de vuelta con el resultado.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.6rem] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-5">
                <p className="text-sm font-semibold text-night">Shopify y WooCommerce</p>
                <p className="mt-1 text-sm text-ink/65">
                  Dejamos estos conectores preparados para mover aquí sus flujos de auth en el siguiente paso.
                </p>
              </div>
            </div>

            <details className="mt-6 rounded-[1.6rem] border border-slate-200 bg-white px-5 py-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-night">
                Mostrar formulario manual
              </summary>
              <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldGroup label="Nombre" required>
                    <input
                      required
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      className={inputClassName()}
                      placeholder="meli CL"
                    />
                  </FieldGroup>

                  <FieldGroup label="Canal" required>
                    <select
                      required
                      value={form.channelId}
                      onChange={(event) => setForm({ ...form, channelId: event.target.value })}
                      disabled={channelOptions.length === 1}
                      className={inputClassName()}
                    >
                      {channelOptions.length !== 1 ? (
                        <option value="">Selecciona un canal</option>
                      ) : null}
                      {channelOptions.map((channel) => (
                        <option key={channel.value} value={channel.value}>
                          {channel.label}
                        </option>
                      ))}
                    </select>
                  </FieldGroup>

                  <FieldGroup label="Estado" required>
                    <select
                      required
                      value={form.status}
                      onChange={(event) => setForm({ ...form, status: event.target.value })}
                      className={inputClassName()}
                    >
                      <option value="active">Activa</option>
                      <option value="inactive">Inactiva</option>
                      <option value="error">Con error</option>
                    </select>
                  </FieldGroup>

                  <FieldGroup label="Moneda">
                    <input
                      value={form.currency}
                      onChange={(event) => setForm({ ...form, currency: event.target.value })}
                      className={inputClassName()}
                      placeholder="CLP"
                    />
                  </FieldGroup>

                  <FieldGroup label="External ID">
                    <input
                      value={form.externalId}
                      onChange={(event) => setForm({ ...form, externalId: event.target.value })}
                      className={inputClassName()}
                      placeholder="meli-demo-account"
                    />
                  </FieldGroup>

                  <FieldGroup label="Access token">
                    <input
                      value={form.accessToken}
                      onChange={(event) => setForm({ ...form, accessToken: event.target.value })}
                      className={inputClassName()}
                      placeholder="token"
                    />
                  </FieldGroup>
                </div>

                <FieldGroup label="Refresh token">
                  <textarea
                    value={form.refreshToken}
                    onChange={(event) => setForm({ ...form, refreshToken: event.target.value })}
                    className={`${inputClassName()} min-h-24`}
                    placeholder="refresh token"
                  />
                </FieldGroup>

                {error ? <FormMessage>{error}</FormMessage> : null}

                <FormActions
                  submitLabel="Guardar manualmente"
                  submitting={createAccount.isPending}
                  onCancel={() =>
                    setForm((current) => ({
                      ...initialForm,
                      channelId: current.channelId,
                    }))
                  }
                />
              </form>
            </details>
            </section>
          </div>
        </div>
      )}
    </PageShell>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={null}>
      <IntegrationsPageContent />
    </Suspense>
  );
}
