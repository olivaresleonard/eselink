'use client';

import { useQueryClient } from '@tanstack/react-query';
import type { Route } from 'next';
import {
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  LayoutGrid,
  Link2,
  Logs,
  MessageSquareMore,
  Menu,
  MapPinned,
  Package,
  ShoppingBag,
  Store,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ComponentType, ReactNode, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { clearStoredSession, getStoredSession, type AuthSession } from '../lib/auth';
import { fetchApi } from '../lib/api';
import { fetchOrdersDataset, getLocalDateKey, getOrdersDatasetQueryKey } from '../lib/orders-query';

const SIDEBAR_SCROLL_STORAGE_KEY = 'eselink:sidebar-scroll-top';

const navigationGroups = [
  {
    label: 'Panel',
    items: [
      {
        href: '/dashboard',
        label: 'Inicio',
        hint: 'Resumen general',
        icon: LayoutGrid,
      },
    ],
  },
  {
    label: 'Canales',
    items: [
      {
        href: '/integrations',
        label: 'Integraciones',
        hint: 'Conexiones y auth',
        icon: Workflow,
      },
      {
        href: '/accounts',
        label: 'Cuentas',
        hint: 'Cuentas operativas',
        icon: Link2,
      },
      {
        href: '/products',
        label: 'Productos',
        hint: 'Catalogo interno',
        icon: Package,
      },
      {
        href: '/listings',
        label: 'Publicaciones',
        hint: 'Estado por canal',
        icon: Store,
      },
    ],
  },
  {
    label: 'Operacion',
    items: [
      {
        href: '/orders',
        label: 'Ordenes',
        hint: 'Ventas centralizadas',
        icon: ShoppingBag,
      },
      {
        href: '/messages',
        label: 'Mensajeria',
        hint: 'Conversaciones y pendientes',
        icon: MessageSquareMore,
      },
      {
        href: '/flex-today',
        label: 'Flex de hoy',
        hint: 'Mapa y entregas del dia',
        icon: MapPinned,
      },
      {
        href: '/sync-logs',
        label: 'Sincronizacion',
        hint: 'Eventos y alertas',
        icon: Logs,
      },
    ],
  },
] as const satisfies ReadonlyArray<{
  label: string;
  items: ReadonlyArray<{
    href: Route;
    label: string;
    hint: string;
    icon: ComponentType<{ className?: string }>;
  }>;
}>;

async function prefetchRouteData(pathname: Route, queryClient: ReturnType<typeof useQueryClient>) {
  if (pathname === '/accounts') {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['accounts-page'],
        queryFn: () => fetchApi('/accounts'),
      }),
      queryClient.prefetchQuery({
        queryKey: ['orders-accounts-options'],
        queryFn: () => fetchApi('/accounts'),
      }),
    ]);
    return;
  }

  if (pathname === '/integrations') {
    await queryClient.prefetchQuery({
      queryKey: ['integrations-page-channels'],
      queryFn: () => fetchApi('/channels'),
    });
    return;
  }

  if (pathname === '/products') {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['products-options'],
        queryFn: () => fetchApi('/products'),
      }),
      queryClient.prefetchQuery({
        queryKey: ['variants-options'],
        queryFn: () => fetchApi('/product-variants'),
      }),
      queryClient.prefetchQuery({
        queryKey: ['inventory-items-options'],
        queryFn: () => fetchApi('/inventory'),
      }),
    ]);
    return;
  }

  if (pathname === '/listings') {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['listings-page'],
        queryFn: () => fetchApi('/listings'),
      }),
      queryClient.prefetchQuery({
        queryKey: ['listings-variants-options'],
        queryFn: () => fetchApi('/product-variants'),
      }),
      queryClient.prefetchQuery({
        queryKey: ['listings-accounts-options'],
        queryFn: () => fetchApi('/accounts'),
      }),
    ]);
    return;
  }

  if (pathname === '/messages') {
    await queryClient.prefetchQuery({
      queryKey: ['messages-page'],
      queryFn: () => fetchApi('/messages'),
    });
    return;
  }

  if (pathname === '/flex-today') {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: ['orders-accounts-options'],
        queryFn: () => fetchApi('/accounts'),
      }),
      queryClient.prefetchQuery({
        queryKey: getOrdersDatasetQueryKey('shippingToday', getLocalDateKey(), undefined, ''),
        queryFn: () => fetchOrdersDataset('shippingToday', getLocalDateKey(), undefined, ''),
      }),
    ]);
    return;
  }

  if (pathname === '/sync-logs') {
    await queryClient.prefetchQuery({
      queryKey: ['sync-logs-page'],
      queryFn: () => fetchApi('/sync-logs'),
    });
  }
}

export function PageShell({
  title,
  description,
  children,
  actionLabel,
  actionContent,
}: {
  title: string;
  description: string;
  children: ReactNode;
  actionLabel?: string;
  actionContent?: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);
  const prefetchedRoutesRef = useRef(new Set<string>());

  useEffect(() => {
    function syncSession() {
      const nextSession = getStoredSession();
      setSession(nextSession);
      setAuthReady(true);

      if (!nextSession) {
        router.replace('/login');
      }
    }

    syncSession();
    window.addEventListener('eselink-auth-changed', syncSession);

    return () => {
      window.removeEventListener('eselink-auth-changed', syncSession);
    };
  }, [router]);

  useEffect(() => {
    const container = navContainerRef.current;
    if (!container || typeof window === 'undefined') {
      return;
    }

    const savedScrollTop = window.sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY);

    const syncActiveVisibility = () => {
      if (savedScrollTop) {
        container.scrollTop = Number(savedScrollTop);
      }

      const activeItem =
        activeItemRef.current ??
        (container.querySelector('[data-sidebar-active="true"]') as HTMLAnchorElement | null);
      if (!activeItem) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();
      const safeTop = containerRect.top + 20;
      const safeBottom = containerRect.bottom - 96;
      const topOverflow = itemRect.top < safeTop;
      const bottomOverflow = itemRect.bottom > safeBottom;

      if (topOverflow) {
        container.scrollTop -= safeTop - itemRect.top;
        return;
      }

      if (bottomOverflow) {
        container.scrollTop += itemRect.bottom - safeBottom;
      }
    };

    requestAnimationFrame(() => {
      syncActiveVisibility();
      requestAnimationFrame(syncActiveVisibility);
    });
  }, [pathname, sidebarCollapsed]);

  function handleLogout() {
    clearStoredSession();
    router.replace('/login');
  }

  if (!authReady || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-[linear-gradient(180deg,#f8fbfd_0%,#eef6fb_100%)]">
        <div className="rounded-[1.6rem] border border-black/5 bg-white/85 px-6 py-5 text-sm font-medium text-ink/60 shadow-panel">
          Cargando sesión...
        </div>
      </div>
    );
  }

  const userEmail = session.user.email;

  function handleRoutePrefetch(href: Route) {
    router.prefetch(href);

    if (prefetchedRoutesRef.current.has(href)) {
      return;
    }

    prefetchedRoutesRef.current.add(href);
    void prefetchRouteData(href, queryClient).catch(() => {
      prefetchedRoutesRef.current.delete(href);
    });
  }

  function SidebarContent({ compact = false }: { compact?: boolean }) {
    return (
      <>
        <div
          className={`border-b border-white/10 bg-gradient-to-br from-sky/45 via-[#10213d] to-ember/28 ${
            compact ? 'p-4' : 'p-6'
          }`}
        >
          <p className="text-xs uppercase tracking-[0.36em] text-white/50">EseLink</p>
          <h2
            className={`mt-3 font-display font-semibold tracking-tight text-white ${
              compact ? 'text-xl' : 'text-2xl'
            }`}
          >
            {compact ? 'Panel' : 'Operación centralizada'}
          </h2>
          {!compact ? (
            <p className="mt-2 text-sm text-white/60">
              Catálogo, órdenes y sincronización en una vista más clara.
            </p>
          ) : null}
        </div>
        <div
          ref={navContainerRef}
          className="scrollbar-hidden min-h-0 flex-1 space-y-5 overflow-y-auto p-4 pb-10"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onScroll={(event) => {
            if (typeof window === 'undefined') {
              return;
            }

            window.sessionStorage.setItem(
              SIDEBAR_SCROLL_STORAGE_KEY,
              String(event.currentTarget.scrollTop),
            );
          }}
        >
          {navigationGroups.map((group) => (
            <div key={group.label}>
              {!compact ? (
                <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.26em] text-white/42">
                  {group.label}
                </p>
              ) : null}
              <nav className="space-y-2">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      ref={active ? activeItemRef : null}
                      data-sidebar-active={active ? 'true' : 'false'}
                      onMouseEnter={() => handleRoutePrefetch(item.href)}
                      onFocus={() => handleRoutePrefetch(item.href)}
                      onClick={() => setSidebarOpen(false)}
                      className={`block rounded-[1rem] border transition ${
                        compact ? 'px-3 py-3 text-center' : 'px-4 py-3'
                      } ${
                        active
                          ? 'border-white/15 bg-white text-night shadow-sm'
                          : 'border-transparent text-white/68 hover:border-white/10 hover:bg-white/6 hover:text-white'
                      }`}
                      style={{ scrollMarginBlock: '20px' }}
                      title={item.label}
                    >
                      <div
                        className={`flex items-center ${
                          compact ? 'justify-center' : 'gap-3'
                        }`}
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            active
                              ? 'bg-night text-white'
                              : 'bg-white/6 text-white/70'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {!compact ? (
                          <span>
                            <p className="text-sm font-semibold">{item.label}</p>
                            <p
                              className={`mt-1 text-xs ${
                                active ? 'text-ink/60' : 'text-white/50'
                              }`}
                            >
                              {item.hint}
                            </p>
                          </span>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 p-4">
          <div className="rounded-[1rem] border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-sm font-semibold">
                <CircleUserRound className="h-5 w-5" />
              </div>
              {!compact ? (
                <div>
                  <p className="text-sm font-semibold text-white">
                    {userEmail}
                  </p>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-1 text-left text-xs font-medium text-white/55 transition hover:text-white"
                  >
                    Cerrar sesión
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="relative h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-r from-sky/20 via-transparent to-aurora/15 blur-3xl" />
      <div className="flex h-full overflow-hidden">
        <div
          className={`fixed inset-0 z-40 bg-night/45 backdrop-blur-sm transition lg:hidden ${
            sidebarOpen
              ? 'pointer-events-auto opacity-100'
              : 'pointer-events-none opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-80 max-w-[86vw] -translate-x-full p-4 transition-transform duration-300 lg:hidden ${
            sidebarOpen ? 'translate-x-0' : ''
          }`}
        >
          <div className="relative flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-gradient-to-b from-[#0b1730] via-night to-[#13233f] text-white shadow-panel">
            <div className="pointer-events-none absolute left-0 top-0 h-44 w-44 rounded-full bg-sky/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-16 left-8 h-36 w-36 rounded-full bg-ember/10 blur-3xl" />
            <div className="flex items-center justify-end p-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                <ChevronLeft className="h-4 w-4" />
                Cerrar
              </button>
            </div>
            <SidebarContent />
          </div>
        </aside>

        <aside
          className={`hidden shrink-0 transition-all duration-300 lg:block ${
            sidebarCollapsed ? 'w-28' : 'w-[292px]'
          }`}
        >
          <div className="relative sticky top-0 flex h-screen flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-[#0b1730] via-night to-[#13233f] text-white shadow-panel">
            <div className="pointer-events-none absolute left-0 top-0 h-56 w-56 rounded-full bg-sky/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-20 left-10 h-44 w-44 rounded-full bg-ember/10 blur-3xl" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-sky/0 via-sky/35 to-ember/0" />
            <div className="flex items-center justify-end p-3">
              <button
                type="button"
                onClick={() => setSidebarCollapsed((current) => !current)}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
                {sidebarCollapsed ? 'Expandir' : 'Colapsar'}
              </button>
            </div>
            <SidebarContent compact={sidebarCollapsed} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(true)}
                      className="mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-sky/20 bg-white/80 text-sky transition hover:bg-white lg:hidden"
                      aria-label="Abrir menú"
                    >
                      <Menu className="h-4 w-4" />
                    </button>
                    <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-white/80 shadow-sm lg:flex">
                      <LayoutGrid className="h-6 w-6 text-sky" />
                    </div>
                    <div>
                      <h1 className="font-display text-3xl font-semibold tracking-tight text-night sm:text-[2.6rem]">
                        {title}
                      </h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/60 sm:text-base">
                        {description}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-3 xl:items-end">
                  {actionContent ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {actionContent}
                    </div>
                  ) : actionLabel ? (
                    <button className="rounded-2xl bg-gradient-to-r from-moss to-aurora px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-moss/20 transition hover:scale-[1.01]">
                      {actionLabel}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
