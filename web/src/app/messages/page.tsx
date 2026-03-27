'use client';

import { useSearchParams } from 'next/navigation';
import type { PlatformCode } from '../../types/eselink';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { inputClassName } from '../../components/form-field';
import { PlatformLogo } from '../../components/platform-brand';
import { PageShell } from '../../components/page-shell';
import { fetchApi, postApi } from '../../lib/api';
import { formatOrderReference } from '../../lib/order-reference';
import { getShippingStageIcon, getShippingStageTone } from '../../lib/table-columns';

type MessageConversation = {
  id: string;
  resource: string;
  packId?: string | null;
  orderId?: string | null;
  unreadCount: number;
  accountId: string;
  accountName: string;
  platform: PlatformCode;
  sellerUserId?: string | null;
  counterpartUserId?: string | null;
  conversationStatus?: string | null;
  conversationSubstatus?: string | null;
  totalMessages: number;
  productTitle?: string | null;
  productImageUrl?: string | null;
  customerName?: string | null;
  orderNumber?: string | null;
  shippingStage?: string | null;
  lastMessage?: {
    id?: string | null;
    text?: string | null;
    status?: string | null;
    createdAt?: string | null;
    readAt?: string | null;
    fromUserId?: string | null;
    fromName?: string | null;
  } | null;
};

type MessagesResponse = {
  data: MessageConversation[];
  meta: {
    totalConversations: number;
    unreadMessages: number;
    accountsProcessed: number;
    accountsWithUnread: number;
    errors: Array<{
      accountId: string;
      accountName: string;
      message: string;
    }>;
  };
};

type MessageThreadResponse = {
  accountId: string;
  accountName: string;
  platform: PlatformCode;
  resource: string;
  packId?: string | null;
  orderId?: string | null;
  sellerUserId?: string | null;
  counterpartUserId?: string | null;
  conversationStatus?: string | null;
  conversationSubstatus?: string | null;
  totalMessages: number;
  productTitle?: string | null;
  productImageUrl?: string | null;
  customerName?: string | null;
  orderNumber?: string | null;
  shippingStage?: string | null;
  messages: Array<{
    id?: string | null;
    text?: string | null;
    status?: string | null;
    createdAt?: string | null;
    readAt?: string | null;
    fromUserId?: string | null;
    fromName?: string | null;
    fromRole?: 'seller' | 'buyer' | null;
  }>;
};

function formatDateTime(value?: string | null, withYear = false) {
  if (!value) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-CL', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' as const } : {}),
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago',
  }).format(new Date(value));
}

function truncate(value?: string | null, limit = 110) {
  if (!value) {
    return 'Sin mensaje visible.';
  }

  return value.length > limit ? `${value.slice(0, limit).trimEnd()}...` : value;
}

function normalizeImageUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  if (value.startsWith('http://')) {
    return value.replace('http://', 'https://');
  }

  return value;
}

function formatShippingStage(stage?: string | null) {
  if (stage === 'ready_to_print') return 'Por imprimir';
  if (stage === 'ready_to_ship') return 'Por despachar';
  if (stage === 'shipped') return 'En tránsito';
  if (stage === 'delivered') return 'Entregada';
  if (stage === 'cancelled') return 'Cancelada';
  if (stage === 'rescheduled') return 'Reprogramada';
  return 'Sin etapa';
}

function formatConversationSubstatus(value?: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getBlockedConversationReason(substatus?: string | null) {
  const normalized = substatus?.toLowerCase() ?? '';

  if (!normalized) {
    return 'Mercado Libre bloqueó esta conversación temporalmente, así que no puedes responder desde aquí.';
  }

  if (normalized.includes('buyer') && normalized.includes('block')) {
    return 'El comprador bloqueó esta conversación, por lo que ya no admite respuestas desde Eselink.';
  }

  if (normalized.includes('expired') || normalized.includes('window')) {
    return 'La ventana disponible para responder ya cerró en Mercado Libre.';
  }

  if (normalized.includes('closed') || normalized.includes('finalized')) {
    return 'La conversación ya fue cerrada en Mercado Libre y quedó solo en modo lectura.';
  }

  return `Esta conversación está bloqueada por Mercado Libre: ${formatConversationSubstatus(
    substatus,
  )}.`;
}

function getMessageShippingStageTone(
  stage?: string | null,
): 'neutral' | 'warning' | 'info' | 'successSoft' | 'danger' | 'orange' {
  const tone = getShippingStageTone(
    (stage as
      | 'ready_to_print'
      | 'ready_to_ship'
      | 'shipped'
      | 'delivered'
      | 'cancelled'
      | 'rescheduled'
      | null
      | undefined) ?? null,
  );

  if (
    tone === 'warning' ||
    tone === 'info' ||
    tone === 'successSoft' ||
    tone === 'danger' ||
    tone === 'orange'
  ) {
    return tone;
  }

  return 'neutral';
}

function MetaChip({
  children,
  tone = 'neutral',
  icon,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'warning' | 'info' | 'successSoft' | 'danger' | 'orange';
  icon?: ReactNode;
}) {
  const styles = {
    neutral: 'border-slate-200 bg-white text-slate-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
    successSoft: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    danger: 'border-rose-200 bg-rose-50 text-rose-800',
    orange: 'border-orange-200 bg-orange-50 text-orange-800',
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${styles[tone]}`}
    >
      {icon ? <span className="shrink-0">{icon}</span> : null}
      {children}
    </span>
  );
}

const MESSAGES_CACHE_KEY = 'messages:conversation-cache';
const MESSAGES_READ_OVERRIDES_KEY = 'messages:read-overrides';

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const requestedConversationId = searchParams.get('conversationId');
  const queryClient = useQueryClient();
  const conversationRefs = useRef(new Map<string, HTMLButtonElement>());
  const previousConversationRects = useRef(new Map<string, DOMRect>());
  const autoMarkedConversationIds = useRef(new Set<string>());
  const [conversationCache, setConversationCache] = useState<Record<string, MessageConversation>>({});
  const [readOverrides, setReadOverrides] = useState<Record<string, string>>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [messageTab, setMessageTab] = useState<'all' | 'unread' | 'read' | 'active' | 'blocked'>(
    'unread',
  );
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformCode | ''>('');

  const messagesQuery = useQuery({
    queryKey: ['messages-page'],
    queryFn: () => fetchApi<MessagesResponse>('/messages'),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    try {
      const storedCache = window.localStorage.getItem(MESSAGES_CACHE_KEY);
      const storedOverrides = window.localStorage.getItem(MESSAGES_READ_OVERRIDES_KEY);

      if (storedCache) {
        const parsed = JSON.parse(storedCache) as Record<string, MessageConversation>;
        if (parsed && typeof parsed === 'object') {
          setConversationCache(parsed);
        }
      }

      if (storedOverrides) {
        const parsed = JSON.parse(storedOverrides) as Record<string, string>;
        if (parsed && typeof parsed === 'object') {
          setReadOverrides(parsed);
        }
      }
    } catch {
      // ignore broken local cache and keep runtime state
    }
  }, []);

  useEffect(() => {
    const incoming = messagesQuery.data?.data ?? [];
    if (incoming.length === 0) {
      return;
    }

    setConversationCache((current) => {
      const next = { ...current };
      for (const conversation of incoming) {
        next[conversation.id] = {
          ...(current[conversation.id] ?? {}),
          ...conversation,
        };
      }
      return next;
    });
  }, [messagesQuery.data]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(conversationCache));
    } catch {
      // ignore storage errors
    }
  }, [conversationCache]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MESSAGES_READ_OVERRIDES_KEY, JSON.stringify(readOverrides));
    } catch {
      // ignore storage errors
    }
  }, [readOverrides]);

  const allConversations = useMemo(
    () => Object.values(conversationCache),
    [conversationCache],
  );

  function getEffectiveUnreadCount(conversation: MessageConversation) {
    const overrideAt = readOverrides[conversation.id];
    if (!overrideAt) {
      return conversation.unreadCount;
    }

    const lastMessageAt = conversation.lastMessage?.createdAt
      ? new Date(conversation.lastMessage.createdAt).getTime()
      : 0;
    const overrideTime = new Date(overrideAt).getTime();

    if (lastMessageAt > overrideTime) {
      return conversation.unreadCount;
    }

    return 0;
  }

  const platformOptions = useMemo(
    () =>
      Array.from(new Set(allConversations.map((conversation) => conversation.platform))).map(
        (platform) => ({
          value: platform,
          label: platform === 'mercadolibre' ? 'Mercado Libre' : platform,
        }),
      ),
    [allConversations],
  );

  const accountOptions = useMemo(
    () =>
      Array.from(
        new Map(
          allConversations.map((conversation) => [
            conversation.accountId,
            {
              value: conversation.accountId,
              label: conversation.accountName,
            },
          ]),
        ).values(),
      ),
    [allConversations],
  );

  const conversations = useMemo(
    () =>
      allConversations.filter((conversation) => {
        if (selectedAccountId && conversation.accountId !== selectedAccountId) {
          return false;
        }

        if (selectedPlatform && conversation.platform !== selectedPlatform) {
          return false;
        }

        const effectiveUnreadCount = getEffectiveUnreadCount(conversation);

        if (
          messageTab === 'unread' &&
          effectiveUnreadCount <= 0 &&
          conversation.id !== selectedConversationId
        ) {
          return false;
        }

        if (messageTab === 'read' && effectiveUnreadCount > 0) {
          return false;
        }

        if (messageTab === 'active' && conversation.conversationStatus !== 'active') {
          return false;
        }

        if (messageTab === 'blocked' && conversation.conversationStatus !== 'blocked') {
          return false;
        }

        return true;
      }),
    [allConversations, selectedAccountId, selectedPlatform, messageTab, readOverrides, selectedConversationId],
  );

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0]?.id ?? null);
    }

    if (
      selectedConversationId &&
      conversations.length > 0 &&
      !conversations.some((conversation) => conversation.id === selectedConversationId)
    ) {
      setSelectedConversationId(conversations[0]?.id ?? null);
    }
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    if (!requestedConversationId || conversations.length === 0) {
      return;
    }

    const matchedConversation = conversations.find(
      (conversation) => conversation.id === requestedConversationId,
    );

    if (matchedConversation && selectedConversationId !== matchedConversation.id) {
      setSelectedConversationId(matchedConversation.id);
    }
  }, [conversations, requestedConversationId, selectedConversationId]);

  const selectedConversation =
    conversations.find((conversation) => conversation.id === selectedConversationId) ?? null;

  const threadQuery = useQuery({
    queryKey: [
      'messages-thread',
      selectedConversation?.accountId ?? null,
      selectedConversation?.resource ?? null,
    ],
    queryFn: () =>
      fetchApi<MessageThreadResponse>(
        `/messages/thread?accountId=${selectedConversation?.accountId}&resource=${encodeURIComponent(
          selectedConversation?.resource ?? '',
        )}`,
      ),
    enabled: Boolean(selectedConversation?.accountId && selectedConversation?.resource),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!selectedConversationId || !threadQuery.data) {
      return;
    }

    setConversationCache((current) => {
      const existing = current[selectedConversationId];
      if (!existing) {
        return current;
      }

      return {
        ...current,
        [selectedConversationId]: {
          ...existing,
          productTitle: threadQuery.data.productTitle ?? existing.productTitle ?? null,
          productImageUrl: threadQuery.data.productImageUrl ?? existing.productImageUrl ?? null,
          customerName: threadQuery.data.customerName ?? existing.customerName ?? null,
          orderNumber: threadQuery.data.orderNumber ?? existing.orderNumber ?? null,
          shippingStage: threadQuery.data.shippingStage ?? existing.shippingStage ?? null,
        },
      };
    });
  }, [selectedConversationId, threadQuery.data]);

  useEffect(() => {
    setDraft('');
  }, [selectedConversationId]);

  const threadConversationStatus = threadQuery.data?.conversationStatus ?? null;
  const threadConversationSubstatus = threadQuery.data?.conversationSubstatus ?? null;
  const isThreadBlocked = threadConversationStatus === 'blocked';
  const blockedConversationReason = isThreadBlocked
    ? getBlockedConversationReason(threadConversationSubstatus)
    : null;

  const groupedAccounts = useMemo(() => {
    const grouped = conversations.reduce<Map<string, MessageConversation[]>>((map, item) => {
      const current = map.get(item.accountId) ?? [];
      current.push(item);
      map.set(item.accountId, current);
      return map;
    }, new Map());

    return Array.from(grouped.entries())
      .map(([accountId, items]) => ({
        accountId,
        accountName: items[0]?.accountName ?? 'Cuenta',
        platform: items[0]?.platform ?? 'mercadolibre',
        unreadCount: items.reduce((sum, item) => sum + getEffectiveUnreadCount(item), 0),
        conversations: items.sort((left, right) => {
          if (left.id === selectedConversationId) return -1;
          if (right.id === selectedConversationId) return 1;

          return (
            new Date(right.lastMessage?.createdAt ?? 0).getTime() -
            new Date(left.lastMessage?.createdAt ?? 0).getTime()
          );
        }),
      }))
      .sort((left, right) => {
        const leftHasSelected = left.conversations.some(
          (conversation) => conversation.id === selectedConversationId,
        );
        const rightHasSelected = right.conversations.some(
          (conversation) => conversation.id === selectedConversationId,
        );

        if (leftHasSelected) return -1;
        if (rightHasSelected) return 1;

        return right.unreadCount - left.unreadCount;
      });
  }, [conversations, messageTab, selectedConversationId]);

  const messageTabCounts = useMemo(
    () => ({
      all: allConversations.filter((conversation) => {
        if (selectedAccountId && conversation.accountId !== selectedAccountId) return false;
        if (selectedPlatform && conversation.platform !== selectedPlatform) return false;
        return true;
      }).length,
      unread: allConversations.filter((conversation) => {
        if (selectedAccountId && conversation.accountId !== selectedAccountId) return false;
        if (selectedPlatform && conversation.platform !== selectedPlatform) return false;
        return getEffectiveUnreadCount(conversation) > 0;
      }).length,
      read: allConversations.filter((conversation) => {
        if (selectedAccountId && conversation.accountId !== selectedAccountId) return false;
        if (selectedPlatform && conversation.platform !== selectedPlatform) return false;
        return getEffectiveUnreadCount(conversation) === 0;
      }).length,
      active: allConversations.filter((conversation) => {
        if (selectedAccountId && conversation.accountId !== selectedAccountId) return false;
        if (selectedPlatform && conversation.platform !== selectedPlatform) return false;
        return conversation.conversationStatus === 'active';
      }).length,
      blocked: allConversations.filter((conversation) => {
        if (selectedAccountId && conversation.accountId !== selectedAccountId) return false;
        if (selectedPlatform && conversation.platform !== selectedPlatform) return false;
        return conversation.conversationStatus === 'blocked';
      }).length,
    }),
    [allConversations, readOverrides, selectedAccountId, selectedPlatform],
  );

  const replyMutation = useMutation({
    mutationFn: (input: {
      accountId: string;
      resource: string;
      text: string;
      toUserId?: string | null;
    }) =>
      postApi('/messages/reply', {
        accountId: input.accountId,
        resource: input.resource,
        text: input.text,
        toUserId: input.toUserId ?? undefined,
      }),
    onSuccess: async () => {
      setDraft('');
      setFeedback('Mensaje enviado correctamente.');
      if (selectedConversation) {
        const markedAt = new Date().toISOString();
        setReadOverrides((current) => ({
          ...current,
          [selectedConversation.id]: markedAt,
        }));
      }
      if (selectedConversation) {
        setConversationCache((current) => ({
          ...current,
          [selectedConversation.id]: {
            ...(current[selectedConversation.id] ?? selectedConversation),
            unreadCount: 0,
            lastMessage: {
              ...(current[selectedConversation.id]?.lastMessage ?? selectedConversation.lastMessage ?? {}),
              text: draft.trim(),
              createdAt: new Date().toISOString(),
            },
          },
        }));
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages-page'] }),
        queryClient.invalidateQueries({ queryKey: ['messages-thread'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-messages-meta'] }),
      ]);
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : 'No pudimos enviar el mensaje.');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (input: { accountId: string; resource: string; silent?: boolean }) =>
      postApi('/messages/mark-read', {
        accountId: input.accountId,
        resource: input.resource,
      }),
    onSuccess: async (_result, variables) => {
      const markedAt = new Date().toISOString();
      setReadOverrides((current) => {
        const matchedConversation = allConversations.find(
          (conversation) =>
            conversation.accountId === variables.accountId &&
            conversation.resource === variables.resource,
        );

        if (!matchedConversation) {
          return current;
        }

        return {
          ...current,
          [matchedConversation.id]: markedAt,
        };
      });

      setConversationCache((current) => {
        const matchedEntry = Object.values(current).find(
          (conversation) =>
            conversation.accountId === variables.accountId &&
            conversation.resource === variables.resource,
        );

        if (!matchedEntry) {
          return current;
        }

        return {
          ...current,
          [matchedEntry.id]: {
            ...matchedEntry,
            unreadCount: 0,
          },
        };
      });

      if (!variables.silent) {
        setFeedback('Conversación marcada como leída.');
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['messages-page'] }),
        queryClient.invalidateQueries({ queryKey: ['messages-thread'] }),
        queryClient.invalidateQueries({ queryKey: ['orders-messages-meta'] }),
      ]);
    },
    onError: (error) => {
      setFeedback(error instanceof Error ? error.message : 'No pudimos marcar como leído.');
    },
  });

  function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedConversation || !threadQuery.data) {
      return;
    }

    if (threadQuery.data.conversationStatus === 'blocked') {
      setFeedback(getBlockedConversationReason(threadQuery.data.conversationSubstatus));
      return;
    }

    const text = draft.trim();
    if (!text) {
      setFeedback('Escribe un mensaje antes de enviarlo.');
      return;
    }

    replyMutation.mutate({
      accountId: selectedConversation.accountId,
      resource: selectedConversation.resource,
      text,
      toUserId: threadQuery.data.counterpartUserId,
    });
  }

  useLayoutEffect(() => {
    const nextRects = new Map<string, DOMRect>();

    conversationRefs.current.forEach((node, id) => {
      const nextRect = node.getBoundingClientRect();
      const previousRect = previousConversationRects.current.get(id);

      if (previousRect) {
        const deltaY = previousRect.top - nextRect.top;

        if (Math.abs(deltaY) > 1) {
          node.animate(
            [
              { transform: `translateY(${deltaY}px)` },
              { transform: 'translateY(0)' },
            ],
            {
              duration: 260,
              easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            },
          );
        }
      }

      nextRects.set(id, nextRect);
    });

    previousConversationRects.current = nextRects;
  }, [groupedAccounts]);

  useEffect(() => {
    if (!selectedConversation || !threadQuery.data || selectedConversation.unreadCount <= 0) {
      return;
    }

    if (autoMarkedConversationIds.current.has(selectedConversation.id)) {
      return;
    }

    autoMarkedConversationIds.current.add(selectedConversation.id);
    markReadMutation.mutate({
      accountId: selectedConversation.accountId,
      resource: selectedConversation.resource,
      silent: true,
    });
  }, [allConversations, markReadMutation, selectedConversation, threadQuery.data]);

  return (
    <PageShell
      title="Mensajería operativa"
      description="Bandeja unificada para conversar con compradores de Mercado Libre sin salir de la operación."
      actionContent={
        <>
          <div className="w-[180px]">
            <label className="mb-1.5 block text-[11px] font-medium text-ink/50">Plataforma</label>
            <select
              value={selectedPlatform}
              onChange={(event) => setSelectedPlatform(event.target.value as PlatformCode | '')}
              className={`${inputClassName()} bg-white`}
            >
              <option value="">Todas las plataformas</option>
              {platformOptions.map((platform) => (
                <option key={platform.value} value={platform.value}>
                  {platform.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[220px]">
            <label className="mb-1.5 block text-[11px] font-medium text-ink/50">Cuenta</label>
            <select
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              className={`${inputClassName()} bg-white`}
            >
              <option value="">Todas las cuentas</option>
              {accountOptions.map((account) => (
                <option key={account.value} value={account.value}>
                  {account.label}
                </option>
              ))}
            </select>
          </div>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMessageTab('all')}
          className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
            messageTab === 'all'
              ? 'border border-night bg-night text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-ink'
          }`}
        >
          Todas
          <span className="ml-2 text-[11px] opacity-80">{messageTabCounts.all}</span>
        </button>
        <button
          type="button"
          onClick={() => setMessageTab('unread')}
          className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
            messageTab === 'unread'
              ? 'border border-night bg-night text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-ink'
          }`}
        >
          Sin leer
          <span className="ml-2 text-[11px] opacity-80">{messageTabCounts.unread}</span>
        </button>
        <button
          type="button"
          onClick={() => setMessageTab('read')}
          className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
            messageTab === 'read'
              ? 'border border-night bg-night text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-ink'
          }`}
        >
          Leídos
          <span className="ml-2 text-[11px] opacity-80">{messageTabCounts.read}</span>
        </button>
        <button
          type="button"
          onClick={() => setMessageTab('active')}
          className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
            messageTab === 'active'
              ? 'border border-night bg-night text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-ink'
          }`}
        >
          Activas
          <span className="ml-2 text-[11px] opacity-80">{messageTabCounts.active}</span>
        </button>
        <button
          type="button"
          onClick={() => setMessageTab('blocked')}
          className={`rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
            messageTab === 'blocked'
              ? 'border border-night bg-night text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-ink'
          }`}
        >
          Bloqueadas
          <span className="ml-2 text-[11px] opacity-80">{messageTabCounts.blocked}</span>
        </button>
      </div>

      <section className="mt-4 grid gap-5 xl:h-[calc(100vh-205px)] xl:min-h-[680px] xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="min-h-[680px] xl:flex xl:h-full xl:min-h-0 xl:flex-col">
          <div className="rounded-[1.7rem] border border-[var(--stroke)] bg-[var(--panel-strong)] shadow-panel min-h-[680px] xl:flex xl:h-full xl:min-h-0 xl:flex-1 xl:flex-col">
            <div className="border-b border-black/5 px-5 py-3.5">
              <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Bandeja</p>
              <p className="mt-2 text-lg font-semibold text-night">
                Conversaciones y contexto de venta
              </p>
              {feedback ? (
                <p className="mt-2 text-sm font-medium text-emerald-700">{feedback}</p>
              ) : null}
            </div>
            <div className="space-y-3 overflow-y-auto px-4 py-3.5 xl:min-h-0 xl:flex-1">
              {messagesQuery.isLoading ? (
                <div className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 p-5 text-sm text-ink/60">
                  Cargando conversaciones...
                </div>
              ) : groupedAccounts.length > 0 ? (
                groupedAccounts.map((group) => (
                  <div key={group.accountId} className="space-y-2">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <PlatformLogo platform={group.platform} className="h-4 w-4 shrink-0" />
                        <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">
                          {group.accountName}
                        </p>
                      </div>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                        {group.conversations.reduce(
                          (sum, conversation) => sum + getEffectiveUnreadCount(conversation),
                          0,
                        )}
                      </span>
                    </div>

                    {group.conversations.map((conversation) => {
                      const active = conversation.id === selectedConversationId;

                      return (
                        <button
                          key={conversation.id}
                          type="button"
                          onClick={() => setSelectedConversationId(conversation.id)}
                          ref={(node) => {
                            if (node) {
                              conversationRefs.current.set(conversation.id, node);
                              return;
                            }

                            conversationRefs.current.delete(conversation.id);
                          }}
                          className={`w-full rounded-[1.3rem] border px-4 py-3 text-left transition ${
                            active
                              ? 'border-slate-800 bg-[linear-gradient(135deg,#162235_0%,#1f334d_52%,#2b4863_100%)] text-white shadow-[0_18px_40px_-22px_rgba(22,34,53,0.5)] ring-2 ring-slate-300/40'
                              : 'border-black/5 bg-white/80 text-night hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              {normalizeImageUrl(conversation.productImageUrl) ? (
                                <img
                                  src={normalizeImageUrl(conversation.productImageUrl)!}
                                  alt={conversation.productTitle ?? 'Producto'}
                                  className={`h-14 w-14 shrink-0 rounded-2xl object-cover ring-1 ${
                                    active ? 'ring-white/30' : 'ring-slate-200'
                                  }`}
                                />
                              ) : (
                                <div
                                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                    active
                                      ? 'bg-white/12 text-white/75 ring-1 ring-white/18'
                                      : 'bg-slate-100 text-ink/40 ring-1 ring-slate-200'
                                  }`}
                                >
                                  Sin foto
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className={`truncate text-sm font-semibold ${active ? 'text-white' : 'text-night'}`}>
                                    {conversation.customerName ||
                                      conversation.productTitle ||
                                      conversation.packId ||
                                      'Conversación'}
                                  </p>
                                  {active ? (
                                    <span className="rounded-full border border-white/20 bg-white/14 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/90">
                                      Abierta
                                    </span>
                                  ) : null}
                                </div>
                                <p className={`mt-1 truncate text-xs ${active ? 'text-white/70' : 'text-ink/50'}`}>
                                  {conversation.orderNumber
                                    ? formatOrderReference(conversation.orderNumber, conversation.packId)
                                    : conversation.packId
                                      ? formatOrderReference(null, conversation.packId)
                                      : conversation.resource}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                active
                                  ? 'bg-white/12 text-white'
                                  : 'border border-amber-200 bg-amber-50 text-amber-800'
                              }`}
                            >
                              {getEffectiveUnreadCount(conversation)}
                            </span>
                          </div>
                          <p className={`mt-3 line-clamp-2 text-sm leading-6 ${active ? 'text-white/84' : 'text-ink/65'}`}>
                            {truncate(conversation.lastMessage?.text, 90)}
                          </p>
                          <div className={`mt-3 flex items-center justify-between text-[11px] ${active ? 'text-white/65' : 'text-ink/45'}`}>
                            <span>{formatShippingStage(conversation.shippingStage)}</span>
                            <span>{formatDateTime(conversation.lastMessage?.createdAt)}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-dashed border-black/10 bg-white/70 p-5 text-sm text-ink/60">
                  No hay conversaciones no leídas para mostrar.
                </div>
              )}
            </div>
          </div>
        </aside>

        <section className="rounded-[1.9rem] border border-[var(--stroke)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,249,252,0.94))] shadow-panel min-h-[680px] xl:min-h-0 xl:overflow-hidden">
          {selectedConversation && threadQuery.data ? (
            <div className="flex h-full min-h-[680px] flex-col xl:min-h-0">
              <div className="border-b border-black/5 px-6 py-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-start gap-4">
                      {normalizeImageUrl(threadQuery.data.productImageUrl) ? (
                        <img
                          src={normalizeImageUrl(threadQuery.data.productImageUrl)!}
                          alt={threadQuery.data.productTitle ?? 'Producto'}
                          className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <PlatformLogo platform={threadQuery.data.platform} className="h-4 w-4 shrink-0" />
                          <p className="text-xs uppercase tracking-[0.22em] text-ink/45">
                            Conversación activa
                          </p>
                        </div>
                        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <h2 className="text-2xl font-semibold tracking-tight text-night">
                            {threadQuery.data.customerName ??
                              threadQuery.data.productTitle ??
                              threadQuery.data.packId ??
                              'Hilo de mensajes'}
                          </h2>
                          <p className="text-sm font-medium text-ink/45">
                            {threadQuery.data.orderNumber
                              ? formatOrderReference(
                                  threadQuery.data.orderNumber,
                                  threadQuery.data.packId,
                                )
                              : threadQuery.data.packId
                                ? formatOrderReference(null, threadQuery.data.packId)
                                : threadQuery.data.resource}
                          </p>
                        </div>
                        {threadQuery.data.productTitle ? (
                          <p className="mt-2 text-sm font-medium text-ink/55">
                            {threadQuery.data.productTitle}
                          </p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {threadQuery.data.conversationSubstatus ? (
                            <MetaChip>
                              {formatConversationSubstatus(threadQuery.data.conversationSubstatus)}
                            </MetaChip>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <MetaChip
                      tone={getMessageShippingStageTone(threadQuery.data.shippingStage)}
                      icon={getShippingStageIcon(
                        (threadQuery.data.shippingStage as
                          | 'ready_to_print'
                          | 'ready_to_ship'
                          | 'shipped'
                          | 'delivered'
                          | 'cancelled'
                          | 'rescheduled'
                          | null
                          | undefined) ?? null,
                      )}
                    >
                      {formatShippingStage(threadQuery.data.shippingStage)}
                    </MetaChip>
                    <MetaChip>{threadQuery.data.totalMessages} mensajes</MetaChip>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5 xl:min-h-0">
                {threadQuery.data.messages.map((message) => {
                  const mine = message.fromRole === 'seller';

                  return (
                    <div
                      key={`${message.id}-${message.createdAt}`}
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-[1.5rem] px-4 py-3 shadow-sm ${
                          mine
                            ? 'bg-night text-white'
                            : 'border border-black/5 bg-white text-night'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2 text-[11px]">
                          <span className={mine ? 'text-white/70' : 'text-ink/45'}>
                            {mine ? 'Tú' : message.fromName ?? threadQuery.data.customerName ?? 'Cliente'}
                          </span>
                          <span className={mine ? 'text-white/55' : 'text-ink/40'}>
                            {formatDateTime(message.createdAt, true)}
                          </span>
                        </div>
                        <p className={`mt-2 text-sm leading-6 ${mine ? 'text-white' : 'text-ink/80'}`}>
                          {message.text || 'Sin texto'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleReplySubmit} className="border-t border-black/5 bg-white/70 px-6 py-4">
                {isThreadBlocked ? (
                  <div className="rounded-[1.6rem] border border-rose-200 bg-[linear-gradient(180deg,rgba(255,241,242,0.96),rgba(255,255,255,0.98))] p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4.5 w-4.5">
                          <path
                            d="M10 2.5A4.5 4.5 0 0 0 5.5 7v1H5A1.5 1.5 0 0 0 3.5 9.5v5A1.5 1.5 0 0 0 5 16h10a1.5 1.5 0 0 0 1.5-1.5v-5A1.5 1.5 0 0 0 15 8h-.5V7A4.5 4.5 0 0 0 10 2.5ZM7 8V7a3 3 0 1 1 6 0v1H7Z"
                            fill="currentColor"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-rose-900">Respuesta bloqueada</p>
                        <p className="mt-1 text-sm leading-6 text-rose-800/90">
                          {blockedConversationReason}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[1.6rem] border border-black/10 bg-white p-3 shadow-sm">
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Escribe una respuesta para el comprador..."
                      className="min-h-[92px] w-full resize-none bg-transparent px-2 py-2 text-sm text-night outline-none placeholder:text-ink/35"
                    />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 px-2 pt-3">
                      <p className="text-xs text-ink/45">Hasta 350 caracteres por mensaje en Mercado Libre.</p>
                      <button
                        type="submit"
                        disabled={replyMutation.isPending || draft.trim().length === 0}
                        className="rounded-full border border-night bg-night px-5 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {replyMutation.isPending ? 'Enviando...' : 'Responder'}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          ) : (
            <div className="flex min-h-[680px] items-center justify-center px-8 py-10 xl:h-full xl:min-h-0">
              <div className="max-w-md text-center">
                <p className="text-xs uppercase tracking-[0.22em] text-ink/45">Mensajería</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-night">
                  Selecciona una conversación para abrir el hilo.
                </h2>
                <p className="mt-3 text-sm leading-7 text-ink/60">
                  Aquí quedará el chat con el comprador, y a la izquierda puedes ir
                  cambiando entre ventas sin perder el contexto operativo.
                </p>
              </div>
            </div>
          )}
        </section>
      </section>
    </PageShell>
  );
}
