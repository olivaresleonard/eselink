import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MercadoLibreApiClient } from '../../integrations/mercadolibre/mercadolibre-api.client.js';
import { MercadoLibreAuthService } from '../../integrations/mercadolibre/mercadolibre-auth.service.js';
import { Account } from '../accounts/account.entity.js';
import { Order } from '../orders/order.entity.js';

type MessagesUnreadResponse = {
  user_id?: string | number;
  results?: Array<{
    resource?: string;
    count?: number;
  }>;
};

type MercadoLibreConversationMessage = {
  id?: string;
  text?: string;
  status?: string;
  from?: {
    user_id?: string | number;
    name?: string;
  };
  message_date?: {
    created?: string | null;
    read?: string | null;
  };
};

type MessagesConversationResponse = {
  conversation_status?: {
    path?: string;
    status?: string;
    substatus?: string | null;
  };
  messages?: MercadoLibreConversationMessage[];
  paging?: {
    total?: number;
  };
};

type MessagesListQuery = {
  accountId?: string;
};

type MercadoLibreItemResponse = {
  id?: string;
  thumbnail?: string | null;
  pictures?: Array<{
    url?: string | null;
    secure_url?: string | null;
  }>;
};

type ConversationResourceInfo = {
  resourceType: string | null;
  resourceId: string | null;
  sellerId: string | null;
};

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  private readonly maxConversationsPerAccount = 80;

  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly authService: MercadoLibreAuthService,
    private readonly apiClient: MercadoLibreApiClient,
  ) {}

  async list(query: MessagesListQuery = {}) {
    const accounts = await this.accountsRepository.find({
      where: {
        ...(query.accountId ? { id: query.accountId } : {}),
      },
      relations: {
        channel: true,
      },
      order: {
        name: 'ASC',
      },
    });

    const mercadoLibreAccounts = accounts.filter(
      (account) =>
        account.status === 'active' &&
        (account.channel?.code === 'mercadolibre' ||
          account.settings?.provider === 'mercadolibre'),
    );

    const accountResults = await Promise.all(
      mercadoLibreAccounts.map(async (account) => {
        try {
          const unread = await this.fetchUnreadResources(account);
          const orders = await this.ordersRepository.find({
            where: { accountId: account.id },
            relations: {
              items: {
                listing: true,
              },
            },
            order: {
              createdAt: 'DESC',
            },
            take: 500,
          });
          const itemImageLookup = await this.buildOrderItemImageLookup(account.id, orders);

          const unreadCountByResource = new Map(
            unread.map((item) => [item.resource, item.count] as const),
          );
          const candidateResources = this.buildCandidateConversationResources(account, orders, unread);

          const conversations = (
            await Promise.all(
              candidateResources.slice(0, this.maxConversationsPerAccount).map(async (resource) => {
                try {
                  const detail = await this.fetchConversation(account.id, resource.resource);
                  const messages = detail.messages ?? [];
                  if (messages.length === 0) {
                    return null;
                  }
                  const lastMessage = messages.at(-1) ?? null;
                  const resourceInfo = this.extractResourceInfo(resource.resource);
                  const counterpartUserId = this.resolveCounterpartUserId(
                    messages,
                    resourceInfo.sellerId,
                  );
                  const linkedOrder = this.findLinkedOrder(orders, resourceInfo.resourceId);

                  return {
                    id: `${account.id}:${resource.resource}`,
                    resource: resource.resource,
                    packId: resourceInfo.resourceType === 'packs' ? resourceInfo.resourceId : null,
                    orderId:
                      resourceInfo.resourceType === 'orders' ? resourceInfo.resourceId : null,
                    unreadCount: unreadCountByResource.get(resource.resource) ?? 0,
                    accountId: account.id,
                    accountName: account.name,
                    platform: 'mercadolibre' as const,
                    sellerUserId: resourceInfo.sellerId,
                    counterpartUserId,
                    conversationStatus: detail.conversation_status?.status ?? null,
                    conversationSubstatus: detail.conversation_status?.substatus ?? null,
                    totalMessages: detail.paging?.total ?? messages.length,
                    productTitle: this.getOrderTitle(linkedOrder),
                    productImageUrl: await this.getOrderImage(linkedOrder, itemImageLookup),
                    customerName: linkedOrder?.customerName ?? linkedOrder?.shippingName ?? null,
                    orderNumber: linkedOrder?.orderNumber ?? null,
                    shippingStage: linkedOrder?.shippingStage ?? null,
                    lastMessage: lastMessage
                      ? {
                          id: lastMessage.id ?? null,
                          text: lastMessage.text ?? '',
                          status: lastMessage.status ?? null,
                          createdAt: lastMessage.message_date?.created ?? null,
                          readAt: lastMessage.message_date?.read ?? null,
                          fromUserId: lastMessage.from?.user_id
                            ? String(lastMessage.from.user_id)
                            : null,
                          fromName: lastMessage.from?.name ?? null,
                        }
                      : null,
                  };
                } catch (error) {
                  this.logger.warn(
                    `No pudimos leer la conversación ${resource.resource} de la cuenta ${account.id}: ${
                      error instanceof Error ? error.message : 'unknown error'
                    }`,
                  );
                  return null;
                }
              }),
            )
          ).filter(Boolean).sort((left, right) => {
            const leftDate = new Date(left?.lastMessage?.createdAt ?? 0).getTime();
            const rightDate = new Date(right?.lastMessage?.createdAt ?? 0).getTime();
            return rightDate - leftDate;
          });

          return {
            accountId: account.id,
            accountName: account.name,
            platform: 'mercadolibre' as const,
            conversations,
            unreadCount: unread.reduce((sum, item) => sum + item.count, 0),
            error: null,
          };
        } catch (error) {
          return {
            accountId: account.id,
            accountName: account.name,
            platform: 'mercadolibre' as const,
            conversations: [],
            unreadCount: 0,
            error: error instanceof Error ? error.message : 'No pudimos conectar la mensajería',
          };
        }
      }),
    );

    const data = accountResults.flatMap((result) => result.conversations);

    return {
      data,
      meta: {
        totalConversations: data.length,
        unreadMessages: accountResults.reduce((sum, item) => sum + item.unreadCount, 0),
        accountsProcessed: mercadoLibreAccounts.length,
        accountsWithUnread: accountResults.filter((item) => item.conversations.length > 0).length,
        errors: accountResults
          .filter((item) => item.error)
          .map((item) => ({
            accountId: item.accountId,
            accountName: item.accountName,
            message: item.error,
          })),
      },
    };
  }

  async markAsRead(input: { accountId: string; resource: string }) {
    const detail = await this.fetchConversation(input.accountId, input.resource, true);

    return {
      success: true,
      totalMessages: detail.paging?.total ?? detail.messages?.length ?? 0,
    };
  }

  async getThread(input: { accountId: string; resource: string }) {
    const account = await this.accountsRepository.findOne({
      where: { id: input.accountId },
      relations: {
        channel: true,
      },
    });

    if (!account) {
      throw new Error('No encontramos la cuenta de la conversación.');
    }

    const detail = await this.fetchConversation(input.accountId, input.resource, false);
    const resourceInfo = this.extractResourceInfo(input.resource);
    const linkedOrder = await this.findLinkedOrderForAccount(input.accountId, resourceInfo);
    const itemImageLookup = await this.buildOrderItemImageLookup(
      input.accountId,
      linkedOrder ? [linkedOrder] : [],
    );
    const messages = detail.messages ?? [];
    const counterpartUserId = this.resolveCounterpartUserId(messages, resourceInfo.sellerId);

    return {
      accountId: account.id,
      accountName: account.name,
      platform: 'mercadolibre' as const,
      resource: input.resource,
      packId: resourceInfo.resourceType === 'packs' ? resourceInfo.resourceId : null,
      orderId: resourceInfo.resourceType === 'orders' ? resourceInfo.resourceId : null,
      sellerUserId: resourceInfo.sellerId,
      counterpartUserId,
      conversationStatus: detail.conversation_status?.status ?? null,
      conversationSubstatus: detail.conversation_status?.substatus ?? null,
      totalMessages: detail.paging?.total ?? messages.length,
      productTitle: this.getOrderTitle(linkedOrder),
      productImageUrl: await this.getOrderImage(linkedOrder, itemImageLookup),
      customerName: linkedOrder?.customerName ?? linkedOrder?.shippingName ?? null,
      orderNumber: linkedOrder?.orderNumber ?? null,
      shippingStage: linkedOrder?.shippingStage ?? null,
      messages: messages.map((message) => ({
        id: message.id ?? null,
        text: message.text ?? '',
        status: message.status ?? null,
        createdAt: message.message_date?.created ?? null,
        readAt: message.message_date?.read ?? null,
        fromUserId: message.from?.user_id ? String(message.from.user_id) : null,
        fromName: message.from?.name ?? null,
        fromRole:
          message.from?.user_id && resourceInfo.sellerId
            ? String(message.from.user_id) === String(resourceInfo.sellerId)
              ? 'seller'
              : 'buyer'
            : null,
      })),
    };
  }

  async reply(input: {
    accountId: string;
    resource: string;
    text: string;
    toUserId?: string;
  }) {
    const resourceInfo = this.extractResourceInfo(input.resource);
    const sellerUserId = resourceInfo.sellerId;

    if (!sellerUserId) {
      throw new Error('No pudimos identificar el vendedor de esta conversación.');
    }

    const detail = await this.fetchConversation(input.accountId, input.resource, false);
    const messages = detail.messages ?? [];
    const counterpartUserId =
      input.toUserId ?? this.resolveCounterpartUserId(messages, sellerUserId);

    if (!counterpartUserId) {
      throw new Error('No pudimos identificar el comprador para responder.');
    }

    const text = input.text.trim();
    if (!text) {
      throw new Error('El mensaje no puede estar vacío.');
    }

    if (text.length > 350) {
      throw new Error('Mercado Libre permite hasta 350 caracteres por mensaje.');
    }

    const accessToken = await this.authService.ensureAccessToken(input.accountId);
    const response = await this.apiClient.request<Record<string, unknown>>(
      `/messages${input.resource}`,
      {
        method: 'POST',
        accessToken,
        query: {
          tag: 'post_sale',
        },
        body: {
          from: {
            user_id: sellerUserId,
          },
          to: {
            user_id: counterpartUserId,
          },
          text,
        },
      },
    );

    return {
      success: true,
      response,
    };
  }

  private async fetchUnreadResources(account: Account) {
    const accessToken = await this.authService.ensureAccessToken(account.id);
    const response = await this.apiClient.request<MessagesUnreadResponse>('/messages/unread', {
      accessToken,
      query: {
        role: 'seller',
        tag: 'post_sale',
      },
    });

    return (response.results ?? [])
      .map((item) => ({
        resource: item.resource ?? '',
        count: Number(item.count ?? 0),
      }))
      .filter((item) => item.resource.length > 0 && item.count > 0);
  }

  private async fetchConversation(accountId: string, resource: string, markAsRead = false) {
    const accessToken = await this.authService.ensureAccessToken(accountId);
    return this.apiClient.request<MessagesConversationResponse>(`/messages${resource}`, {
      accessToken,
      query: {
        tag: 'post_sale',
        mark_as_read: markAsRead,
      },
    });
  }

  private buildCandidateConversationResources(
    account: Account,
    orders: Order[],
    unread: Array<{ resource: string; count: number }>,
  ) {
    const resources = new Map<string, { resource: string }>();
    const sellerId = account.externalId;

    for (const item of unread) {
      if (item.resource) {
        resources.set(item.resource, { resource: item.resource });
      }
    }

    for (const order of orders) {
      const packId = this.extractPackId(order.rawPayload);
      const resourceId = packId ?? order.externalOrderId;
      const resourceType = packId ? 'packs' : 'orders';

      if (!resourceId || !sellerId) {
        continue;
      }

      const resource = `/${resourceType}/${resourceId}/sellers/${sellerId}`;
      resources.set(resource, { resource });
    }

    return Array.from(resources.values());
  }

  private extractResourceInfo(resource: string): ConversationResourceInfo {
    const match = resource.match(/^\/(?<type>packs|orders)\/(?<id>[^/]+)\/sellers\/(?<sellerId>[^/]+)$/);

    return {
      resourceType: match?.groups?.type ?? null,
      resourceId: match?.groups?.id ?? null,
      sellerId: match?.groups?.sellerId ?? null,
    };
  }

  private async findLinkedOrderForAccount(
    accountId: string,
    resourceInfo: ConversationResourceInfo,
  ) {
    if (!resourceInfo.resourceId) {
      return null;
    }

    const orders = await this.ordersRepository.find({
      where: { accountId },
      relations: {
        items: {
          listing: true,
        },
      },
      order: {
        createdAt: 'DESC',
      },
      take: 400,
    });

    return this.findLinkedOrder(orders, resourceInfo.resourceId);
  }

  private resolveCounterpartUserId(
    messages: MercadoLibreConversationMessage[],
    sellerId: string | null,
  ) {
    if (!sellerId) {
      return null;
    }

    const counterpart = messages.find(
      (message) =>
        message.from?.user_id &&
        String(message.from.user_id) !== String(sellerId),
    );

    return counterpart?.from?.user_id ? String(counterpart.from.user_id) : null;
  }

  private findLinkedOrder(orders: Order[], resourceId: string | null) {
    if (!resourceId) {
      return null;
    }

    return (
      orders.find((order) => order.externalOrderId === resourceId) ??
      orders.find((order) => this.extractPackId(order.rawPayload) === resourceId) ??
      null
    );
  }

  private getOrderTitle(order: Order | null) {
    if (!order) {
      return null;
    }

    const firstItem = order.items?.[0];
    if (firstItem?.title) {
      return firstItem.title;
    }

    const rawOrderItems = Array.isArray((order.rawPayload ?? {}).order_items)
      ? ((order.rawPayload ?? {}).order_items as Array<Record<string, unknown>>)
      : [];
    const rawTitle = rawOrderItems[0]?.item && typeof rawOrderItems[0].item === 'object'
      ? (rawOrderItems[0].item as Record<string, unknown>).title
      : null;

    return typeof rawTitle === 'string' ? rawTitle : null;
  }

  private async getOrderImage(
    order: Order | null,
    itemImageLookup: Map<string, string>,
  ) {
    if (!order) {
      return null;
    }

    const rawOrderItems = Array.isArray((order.rawPayload ?? {}).order_items)
      ? ((order.rawPayload ?? {}).order_items as Array<Record<string, unknown>>)
      : [];
    const rawItem =
      rawOrderItems[0]?.item && typeof rawOrderItems[0].item === 'object'
        ? (rawOrderItems[0].item as Record<string, unknown>)
        : null;

    const rawImage = this.extractImageUrlFromRawItem(rawItem);
    if (rawImage) {
      return rawImage;
    }

    const externalItemId = this.getPrimaryExternalItemId(order);
    const firstItem = order.items?.[0];
    const linkedListingExternalId = firstItem?.listing?.externalListingId ?? null;

    if (
      externalItemId &&
      linkedListingExternalId &&
      linkedListingExternalId === externalItemId
    ) {
      const listingMetadata =
        (firstItem?.listing?.metadata as Record<string, unknown> | null | undefined) ?? null;
      const listingImage = this.extractImageUrlFromListingMetadata(listingMetadata);
      if (listingImage) {
        return listingImage;
      }
    }

    if (externalItemId) {
      return itemImageLookup.get(externalItemId) ?? null;
    }

    return null;
  }

  private async buildOrderItemImageLookup(accountId: string, orders: Order[]) {
    const externalItemIds = Array.from(
      new Set(
        orders
          .map((order) => this.getPrimaryExternalItemId(order))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (externalItemIds.length === 0) {
      return new Map<string, string>();
    }

    const accessToken = await this.authService.ensureAccessToken(accountId);
    const lookups = await Promise.all(
      externalItemIds.map(async (externalItemId) => {
        try {
          const item = await this.apiClient.request<MercadoLibreItemResponse>(
            `/items/${externalItemId}`,
            {
              accessToken,
            },
          );
          const image = this.extractImageUrlFromMercadoLibreItem(item);
          return image ? ([externalItemId, image] as const) : null;
        } catch (error) {
          this.logger.warn(
            `No pudimos leer la imagen del item ${externalItemId}: ${
              error instanceof Error ? error.message : 'unknown error'
            }`,
          );
          return null;
        }
      }),
    );

    return new Map(
      lookups.filter((value): value is readonly [string, string] => Boolean(value)),
    );
  }

  private getPrimaryExternalItemId(order: Order) {
    const orderItemExternalId = order.items?.[0]?.externalItemId;
    if (orderItemExternalId) {
      return orderItemExternalId;
    }

    const rawOrderItems = Array.isArray((order.rawPayload ?? {}).order_items)
      ? ((order.rawPayload ?? {}).order_items as Array<Record<string, unknown>>)
      : [];
    const rawItem =
      rawOrderItems[0]?.item && typeof rawOrderItems[0].item === 'object'
        ? (rawOrderItems[0].item as Record<string, unknown>)
        : null;

    return typeof rawItem?.id === 'string' ? rawItem.id : null;
  }

  private extractImageUrlFromMercadoLibreItem(item?: MercadoLibreItemResponse | null) {
    if (!item) {
      return null;
    }

    if (typeof item.thumbnail === 'string' && item.thumbnail.length > 0) {
      return item.thumbnail;
    }

    const firstPicture = item.pictures?.[0];
    if (!firstPicture) {
      return null;
    }

    if (typeof firstPicture.secure_url === 'string' && firstPicture.secure_url.length > 0) {
      return firstPicture.secure_url;
    }

    if (typeof firstPicture.url === 'string' && firstPicture.url.length > 0) {
      return firstPicture.url;
    }

    return null;
  }

  private extractImageUrlFromListingMetadata(metadata?: Record<string, unknown> | null) {
    if (!metadata) {
      return null;
    }

    if (typeof metadata.thumbnail === 'string') {
      return metadata.thumbnail;
    }

    const pictures = metadata.pictures;
    if (!Array.isArray(pictures) || pictures.length === 0) {
      return null;
    }

    const firstPicture = pictures[0];
    if (typeof firstPicture === 'string') {
      return firstPicture;
    }

    if (
      typeof firstPicture === 'object' &&
      firstPicture !== null &&
      'url' in firstPicture &&
      typeof firstPicture.url === 'string'
    ) {
      return firstPicture.url;
    }

    return null;
  }

  private extractImageUrlFromRawItem(item?: Record<string, unknown> | null) {
    if (!item) {
      return null;
    }

    if (typeof item.thumbnail === 'string') {
      return item.thumbnail;
    }

    if (typeof item.picture_url === 'string') {
      return item.picture_url;
    }

    const pictures = item.pictures;
    if (!Array.isArray(pictures) || pictures.length === 0) {
      return null;
    }

    const firstPicture = pictures[0];
    if (typeof firstPicture === 'string') {
      return firstPicture;
    }

    if (
      typeof firstPicture === 'object' &&
      firstPicture !== null &&
      'url' in firstPicture &&
      typeof firstPicture.url === 'string'
    ) {
      return firstPicture.url;
    }

    return null;
  }

  private extractPackId(rawPayload?: Record<string, unknown> | null) {
    const packId = rawPayload?.pack_id;

    if (typeof packId === 'string' || typeof packId === 'number') {
      return String(packId);
    }

    return null;
  }
}
