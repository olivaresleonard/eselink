import type { ConnectedAccount, OrderRow, PlatformCode } from '../../types/eselink';
import { PlatformLogo } from '../../components/platform-brand';
import { PageShell } from '../../components/page-shell';
import { fetchApi, formatCurrency } from '../../lib/api';

export const revalidate = 60;

type OrdersResponse = {
  data: Array<
    OrderRow & {
      account?: string | null;
      importedAt?: string | null;
      productTitle?: string | null;
    }
  >;
  meta?: {
    total?: number;
  };
};

type AccountPerformance = {
  id: string;
  name: string;
  platform: PlatformCode | null;
  revenue: number;
  orders: number;
  units: number;
  averageTicket: number;
  share: number;
};

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('es-CL', {
    maximumFractionDigits: 0,
  }).format(value);
}

function getChileDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Santiago',
  }).format(date);
}

function getChileDayKey(value: string | Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

function getDaysAgoInChile(days: number) {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now;
}

export default async function DashboardPage() {
  const [ordersResponse, accounts] = await Promise.all([
    fetchApi<OrdersResponse>('/orders?limit=500'),
    fetchApi<ConnectedAccount[]>('/accounts'),
  ]);

  const allOrders = ordersResponse.data ?? [];
  const activeAccounts = accounts.filter((account) => account.status === 'active');
  const todayKey = getChileDayKey(new Date());
  const weekStart = getDaysAgoInChile(7).getTime();
  const orders = allOrders.filter((order) =>
    new Date(order.importedAt ?? order.createdAt).getTime() >= weekStart,
  );

  const performanceByAccount = new Map<string, AccountPerformance>();

  for (const order of orders) {
    const accountName = order.account?.trim() || 'Cuenta sin nombre';
    const current = performanceByAccount.get(order.accountId) ?? {
      id: order.accountId,
      name: accountName,
      platform: order.platform ?? null,
      revenue: 0,
      orders: 0,
      units: 0,
      averageTicket: 0,
      share: 0,
    };

    current.revenue += order.totalAmount ?? 0;
    current.orders += 1;
    current.units += order.totalUnits ?? 0;
    current.platform = current.platform ?? order.platform ?? null;
    performanceByAccount.set(order.accountId, current);
  }

  const accountPerformance = Array.from(performanceByAccount.values())
    .map((item) => ({
      ...item,
      averageTicket: item.orders > 0 ? item.revenue / item.orders : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue);

  const totalRevenue = accountPerformance.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = orders.length;
  const totalUnits = accountPerformance.reduce((sum, item) => sum + item.units, 0);
  const todayOrders = orders.filter((order) =>
    getChileDayKey(order.importedAt ?? order.createdAt) === todayKey,
  ).length;

  const rankedAccounts = accountPerformance.map((item) => ({
    ...item,
    share: totalRevenue > 0 ? item.revenue / totalRevenue : 0,
  }));

  const leader = rankedAccounts[0] ?? null;
  const runnerUp = rankedAccounts[1] ?? null;
  const bestAverageTicket = [...rankedAccounts].sort(
    (left, right) => right.averageTicket - left.averageTicket,
  )[0] ?? null;
  const trailingAccounts = rankedAccounts.slice(1);

  const metrics = [
    {
      label: 'Cuentas activas',
      value: formatCompactNumber(activeAccounts.length),
      detail:
        leader !== null
          ? `${leader.name} lidera la última semana`
          : 'Sin datos suficientes todavía',
      accent: 'from-sky to-cyan-400',
    },
    {
      label: 'Órdenes 7 días',
      value: formatCompactNumber(totalOrders),
      detail: `${formatCompactNumber(todayOrders)} nuevas el ${getChileDateLabel()}`,
      accent: 'from-ember to-orange-300',
    },
    {
      label: 'Venta 7 días',
      value: formatCurrency(totalRevenue || 0),
      detail:
        totalUnits > 0
          ? `${formatCompactNumber(totalUnits)} unidades en la última semana`
          : 'Sin unidades registradas todavía',
      accent: 'from-moss to-aurora',
    },
    {
      label: 'Ticket promedio',
      value: formatCurrency(totalOrders > 0 ? totalRevenue / totalOrders : 0),
      detail:
        bestAverageTicket !== null
          ? `${bestAverageTicket.name} tiene el ticket más alto`
          : 'Aún no hay cuentas para comparar',
      accent: 'from-night to-sky',
    },
  ];

  const quickInsights = [
    leader
      ? {
          title: 'Cuenta que más vende',
          detail: `${leader.name} suma ${formatCurrency(leader.revenue)} y aporta ${Math.round(
            leader.share * 100,
          )}% de la venta visible.`,
        }
      : null,
    runnerUp
      ? {
          title: 'Competencia más cercana',
          detail: `${runnerUp.name} sigue con ${formatCurrency(
            runnerUp.revenue,
          )}. La diferencia con la líder es de ${formatCurrency(
            Math.max((leader?.revenue ?? 0) - runnerUp.revenue, 0),
          )}.`,
        }
      : null,
    bestAverageTicket
      ? {
          title: 'Mejor ticket promedio',
          detail: `${bestAverageTicket.name} promedia ${formatCurrency(
            bestAverageTicket.averageTicket,
          )} por orden.`,
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; detail: string }>;

  return (
    <PageShell
      title="Dashboard omnicanal"
      description="Monitorea el pulso de tu operación con una vista simple, visual y rápida para cuentas, catálogo, órdenes y sincronizaciones."
      actionLabel="Ver reportes"
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="relative overflow-hidden rounded-[1.6rem] border border-[var(--stroke)] bg-[var(--panel-strong)] p-5 shadow-panel"
          >
            <div
              className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${metric.accent}`}
            />
            <p className="text-sm text-ink/55">{metric.label}</p>
            <p className="mt-3 font-display text-4xl font-semibold tracking-tight text-night">
              {metric.value}
            </p>
            <p className="mt-2 text-sm text-ink/60">{metric.detail}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.95fr]">
        <article className="overflow-hidden rounded-[1.6rem] border border-[var(--stroke)] bg-[var(--panel-strong)] shadow-panel">
          <div className="border-b border-black/5 p-6">
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">
              Comparativa de cuentas
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-night">
              Quién empuja más la venta, de un vistazo.
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-ink/60">
              Compara facturación, volumen de órdenes y peso relativo de cada cuenta
              sobre la última semana para detectar rápido quién empuja más la venta.
            </p>
          </div>

          {leader ? (
            <div className="grid gap-5 p-6 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="rounded-[1.5rem] border border-emerald-200/70 bg-[linear-gradient(135deg,rgba(225,255,244,0.95),rgba(242,250,255,0.95))] p-5 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-700/75">
                  Lider actual
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/90 shadow-sm">
                    <PlatformLogo
                      platform={leader.platform}
                      className="h-6 w-6 shrink-0"
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-night">{leader.name}</h3>
                    <p className="text-sm text-ink/60">
                      {leader.orders} órdenes · {formatCompactNumber(leader.units)} unidades
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.1rem] border border-white/70 bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/45">
                      Facturación
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-night">
                      {formatCurrency(leader.revenue)}
                    </p>
                  </div>
                  <div className="rounded-[1.1rem] border border-white/70 bg-white/80 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-ink/45">
                      Participación
                    </p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-night">
                      {Math.round(leader.share * 100)}%
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-6 text-ink/65">
                  {runnerUp
                    ? `Le saca ${formatCurrency(
                        Math.max(leader.revenue - runnerUp.revenue, 0),
                      )} a ${runnerUp.name}.`
                    : 'Por ahora es la única cuenta con ventas en el dashboard.'}
                </p>
              </div>

              <div className="space-y-3">
                {rankedAccounts.map((account, index) => {
                  const barWidth = Math.max(account.share * 100, 8);

                  return (
                    <div
                      key={account.id}
                      className="rounded-[1.2rem] border border-black/5 bg-white/80 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-night">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <PlatformLogo
                                platform={account.platform}
                                className="h-4 w-4 shrink-0"
                              />
                              <p className="truncate text-sm font-semibold text-night">
                                {account.name}
                              </p>
                            </div>
                            <p className="mt-1 text-xs text-ink/55">
                              {account.orders} órdenes · ticket promedio{' '}
                              {formatCurrency(account.averageTicket)}
                            </p>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-night">
                          {formatCurrency(account.revenue)}
                        </p>
                      </div>
                      <div className="mt-4">
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sky via-cyan-400 to-emerald-400"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs text-ink/50">
                          <span>{formatCompactNumber(account.units)} unidades</span>
                          <span>{Math.round(account.share * 100)}% del total</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-6">
              <div className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 p-6 text-sm text-ink/60">
                Todavía no hay órdenes importadas suficientes para comparar cuentas.
              </div>
            </div>
          )}
        </article>

        <div className="space-y-6">
          <article className="rounded-[1.6rem] border border-[var(--stroke)] bg-[var(--panel-strong)] p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">
              Lectura rápida
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-night">
              Lo que conviene mirar primero.
            </h2>
            <div className="mt-5 space-y-3">
              {quickInsights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.1rem] border border-black/5 bg-white/80 p-4"
                >
                  <p className="text-sm font-semibold text-night">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-ink/60">{item.detail}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.6rem] border border-[var(--stroke)] bg-[var(--panel-strong)] p-6 shadow-panel">
            <p className="text-xs uppercase tracking-[0.24em] text-ink/45">
              Comparación directa
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-night">
              Diferencia entre líder y perseguidora.
            </h2>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[1.1rem] border border-black/5 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/45">
                  Brecha de facturación
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-night">
                  {leader && runnerUp
                    ? formatCurrency(Math.max(leader.revenue - runnerUp.revenue, 0))
                    : formatCurrency(0)}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-black/5 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/45">
                  Cuenta con mejor ticket
                </p>
                <p className="mt-2 text-lg font-semibold text-night">
                  {bestAverageTicket?.name ?? 'Sin datos'}
                </p>
                <p className="mt-1 text-sm text-ink/60">
                  {bestAverageTicket
                    ? `${formatCurrency(bestAverageTicket.averageTicket)} por orden`
                    : 'Todavía no hay órdenes para comparar'}
                </p>
              </div>
              <div className="rounded-[1.1rem] border border-black/5 bg-white/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-ink/45">
                  Cuentas activas sin venta visible
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-night">
                  {Math.max(activeAccounts.length - rankedAccounts.length, 0)}
                </p>
                <p className="mt-1 text-sm text-ink/60">
                  {trailingAccounts.length > 0
                    ? `${trailingAccounts.length} cuentas vienen detrás de la líder.`
                    : 'Todavía no hay competencia suficiente para medir arrastre.'}
                </p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </PageShell>
  );
}
