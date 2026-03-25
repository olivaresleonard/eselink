import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ListingStatus, OrderEventType, PlatformCode } from '../../common/entities/domain.enums.js';
import { Account } from '../../modules/accounts/account.entity.js';
import { InventoryItem } from '../../modules/inventory/inventory-item.entity.js';
import { Listing } from '../../modules/listings/listing.entity.js';
import { OrderEvent } from '../../modules/order-events/order-event.entity.js';
import { OrderItem } from '../../modules/order-items/order-item.entity.js';
import { Order } from '../../modules/orders/order.entity.js';
import { ProductVariant } from '../../modules/product-variants/product-variant.entity.js';
import { Product } from '../../modules/products/product.entity.js';
import { SkuMapping } from '../../modules/sku-mappings/sku-mapping.entity.js';
import { SyncLogsService } from '../../modules/sync-logs/sync-logs.service.js';
import { WebhookEvent } from '../../modules/webhooks/webhook-event.entity.js';
import {
  ChannelIntegrationService,
  type NormalizedOrder,
} from '../channel-integration.interface.js';
import { MercadoLibreApiClient } from './mercadolibre-api.client.js';
import { MercadoLibreAuthService } from './mercadolibre-auth.service.js';
import { MercadoLibreMapper } from './mercadolibre.mapper.js';

type MercadoLibreItemSearchResponse = {
  results: string[];
  paging?: { total?: number; limit?: number; offset?: number };
};

type MercadoLibreItem = {
  id: string;
  title: string;
  status?: string;
  price?: number;
  currency_id?: string;
  available_quantity?: number;
  permalink?: string;
  category_id?: string;
  seller_custom_field?: string | null;
  attributes?: Array<{ id?: string; value_name?: string }>;
  variations?: Array<{ id?: number | string; seller_custom_field?: string | null }>;
};

type MercadoLibreOrdersSearchResponse = {
  results: Array<Record<string, unknown>>;
};

@Injectable()
export class MercadoLibreService implements ChannelIntegrationService {
  readonly platform = PlatformCode.MERCADOLIBRE;

  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemsRepository: Repository<InventoryItem>,
    @InjectRepository(SkuMapping)
    private readonly skuMappingsRepository: Repository<SkuMapping>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(OrderEvent)
    private readonly orderEventsRepository: Repository<OrderEvent>,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventsRepository: Repository<WebhookEvent>,
    private readonly authService: MercadoLibreAuthService,
    private readonly apiClient: MercadoLibreApiClient,
    private readonly mapper: MercadoLibreMapper,
    private readonly syncLogsService: SyncLogsService,
  ) {}

  async importListings(input: { accountId: string; workspaceId: string }) {
    const account = await this.loadAccount(input.accountId);
    const accessToken = await this.authService.ensureAccessToken(account.id);
    const itemIds = await this.fetchListingIds(account.externalId, accessToken);
    const imported: Array<{ listingId: string; sku: string }> = [];

    for (const itemId of itemIds) {
      const item = await this.apiClient.request<MercadoLibreItem>(`/items/${itemId}`, {
        method: 'GET',
        accessToken,
      });

      const mapped = this.mapper.mapItem({
        workspaceId: input.workspaceId,
        accountId: account.id,
        channelId: account.channelId,
        item,
      });
      const productReference = this.resolveProductReference(item, mapped.variant.sku);

      let variant = await this.variantsRepository.findOne({
        where: {
          workspaceId: input.workspaceId,
          sku: mapped.variant.sku,
        },
        relations: {
          product: true,
        },
      });

      let product =
        variant?.product ??
        (await this.productsRepository.findOne({
          where: {
            workspaceId: input.workspaceId,
            internalReference: productReference,
          },
        }));

      if (!product) {
        product = this.productsRepository.create({
          ...mapped.product,
          handle: productReference,
          internalReference: productReference,
        });
      } else {
        product.title = mapped.product.title;
        product.status = mapped.product.status;
        product.attributes = {
          ...(product.attributes ?? {}),
          ...(mapped.product.attributes ?? {}),
        };
        product.internalReference = product.internalReference ?? productReference;
      }
      product = await this.productsRepository.save(product);

      if (!variant) {
        variant = this.variantsRepository.create({
          ...mapped.variant,
          productId: product.id,
        });
      } else {
        Object.assign(variant, mapped.variant);
      }
      variant = await this.variantsRepository.save(variant);

      let inventoryItem = await this.inventoryItemsRepository.findOne({
        where: {
          workspaceId: input.workspaceId,
          variantId: variant.id,
          locationCode: 'default',
        },
      });

      if (!inventoryItem) {
        inventoryItem = this.inventoryItemsRepository.create({
          workspaceId: input.workspaceId,
          variantId: variant.id,
          locationCode: 'default',
        });
      }

      inventoryItem.onHand = mapped.listing.stock ?? 0;
      inventoryItem.available = mapped.listing.stock ?? 0;
      await this.inventoryItemsRepository.save(inventoryItem);

      let listing = await this.listingsRepository.findOne({
        where: {
          workspaceId: input.workspaceId,
          accountId: account.id,
          externalListingId: item.id,
        },
      });

      if (!listing) {
        listing = this.listingsRepository.create({
          ...mapped.listing,
          productId: product.id,
          variantId: variant.id,
        });
      } else {
        Object.assign(listing, mapped.listing);
        listing.productId = product.id;
        listing.variantId = variant.id;
      }
      listing = await this.listingsRepository.save(listing);

      let skuMapping = await this.skuMappingsRepository.findOne({
        where: {
          workspaceId: input.workspaceId,
          accountId: account.id,
          externalSku: mapped.variant.sku,
        },
      });

      if (!skuMapping) {
        skuMapping = this.skuMappingsRepository.create({
          workspaceId: input.workspaceId,
          accountId: account.id,
          externalSku: mapped.variant.sku,
        });
      }

      skuMapping.variantId = variant.id;
      skuMapping.listingId = listing.id;
      skuMapping.internalSku = variant.sku;
      skuMapping.externalProductId = item.id;
      skuMapping.externalVariantId =
        item.variations?.[0]?.id !== undefined ? String(item.variations[0].id) : null;
      skuMapping.isPrimary = true;
      skuMapping.metadata = item as Record<string, unknown>;
      await this.skuMappingsRepository.save(skuMapping);

      imported.push({
        listingId: listing.id,
        sku: variant.sku,
      });
    }

    await this.syncLogsService.create({
      workspaceId: input.workspaceId,
      accountId: account.id,
      action: 'import_listings',
      status: 'completed',
      message: 'Mercado Libre listings imported',
      payloadSummary: {
        importedCount: imported.length,
      },
    });

    return {
      importedCount: imported.length,
      imported,
    };
  }

  async updateStock(input: {
    accountExternalId: string;
    externalListingId?: string | null;
    externalSku?: string | null;
    availableStock: number;
    payload?: Record<string, unknown>;
  }) {
    const account = await this.accountsRepository.findOneByOrFail({
      externalId: input.accountExternalId,
    });
    const accessToken = await this.authService.ensureAccessToken(account.id);
    const itemId =
      input.externalListingId ??
      (typeof input.payload?.itemId === 'string' ? input.payload.itemId : null);

    if (!itemId) {
      throw new NotFoundException('Mercado Libre item id is required to update stock');
    }

    return this.apiClient.request<Record<string, unknown>>(`/items/${itemId}`, {
      method: 'PUT',
      accessToken,
      body: {
        available_quantity: input.availableStock,
      },
    });
  }

  async updatePrice(input: {
    accountExternalId: string;
    externalListingId?: string | null;
    externalSku?: string | null;
    price: number;
    currency?: string;
    payload?: Record<string, unknown>;
  }) {
    const account = await this.accountsRepository.findOneByOrFail({
      externalId: input.accountExternalId,
    });
    const accessToken = await this.authService.ensureAccessToken(account.id);
    const itemId =
      input.externalListingId ??
      (typeof input.payload?.itemId === 'string' ? input.payload.itemId : null);

    if (!itemId) {
      throw new NotFoundException('Mercado Libre item id is required to update price');
    }

    return this.apiClient.request<Record<string, unknown>>(`/items/${itemId}`, {
      method: 'PUT',
      accessToken,
      body: {
        price: input.price,
      },
    });
  }

  private resolveProductReference(item: MercadoLibreItem, resolvedSku: string) {
    const sellerSku = item.seller_custom_field?.trim();

    if (sellerSku) {
      return sellerSku;
    }

    const attributeSku = item.attributes
      ?.find((attribute) => attribute.id === 'SELLER_SKU')
      ?.value_name?.trim();

    if (attributeSku) {
      return attributeSku;
    }

    const normalizedTitle = item.title
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);

    return `ml-product:${item.category_id ?? 'uncategorized'}:${normalizedTitle || resolvedSku.toLowerCase()}`;
  }

  async publishListing(input: {
    accountExternalId: string;
    listingId: string;
    title: string;
    externalSku?: string | null;
    price?: number | null;
    availableStock?: number | null;
    payload?: Record<string, unknown>;
  }) {
    const account = await this.accountsRepository.findOneByOrFail({
      externalId: input.accountExternalId,
    });
    const accessToken = await this.authService.ensureAccessToken(account.id);

    return this.apiClient.request<Record<string, unknown>>('/items', {
      method: 'POST',
      accessToken,
      body: {
        title: input.title,
        price: input.price,
        available_quantity: input.availableStock,
        seller_custom_field: input.externalSku,
        currency_id: input.payload?.currency ?? 'CLP',
        category_id: input.payload?.category_id ?? 'MLC1055',
      },
    });
  }

  async fetchOrders(input: {
    accountExternalId: string;
    payload?: Record<string, unknown>;
  }): Promise<NormalizedOrder[]> {
    const account = await this.accountsRepository.findOneByOrFail({
      externalId: input.accountExternalId,
    });
    const accessToken = await this.authService.ensureAccessToken(account.id);

    const response = await this.apiClient.request<MercadoLibreOrdersSearchResponse>(
      '/orders/search',
      {
        method: 'GET',
        accessToken,
        query: {
          seller: input.accountExternalId,
          sort: 'date_desc',
          limit: typeof input.payload?.limit === 'number' ? input.payload.limit : 50,
        },
      },
    );

    return response.results.map((order) =>
      this.mapper.mapOrder(order as Record<string, unknown> as never),
    );
  }

  async processWebhookEvent(event: WebhookEvent) {
    const payload = event.payload;

    if (typeof payload.resource === 'string' && payload.resource.includes('/orders/')) {
      const externalOrderId = payload.resource.split('/').pop();
      if (externalOrderId && event.accountId) {
        const order = await this.ordersRepository.findOne({
          where: {
            workspaceId: event.workspaceId,
            accountId: event.accountId,
            externalOrderId,
          },
        });

        if (order) {
          order.externalStatus =
            typeof payload.status === 'string' ? payload.status : order.externalStatus;
          await this.ordersRepository.save(order);

          await this.orderEventsRepository.save(
            this.orderEventsRepository.create({
              workspaceId: event.workspaceId,
              orderId: order.id,
              type: OrderEventType.WEBHOOK_RECEIVED,
              notes: 'Mercado Libre webhook processed',
              payload,
            }),
          );
        }
      }
    }

    if (typeof payload.user_id === 'number' && typeof payload.resource === 'string') {
      const listingId = payload.resource.split('/').pop();
      if (listingId) {
        const listing = await this.listingsRepository.findOne({
          where: {
            workspaceId: event.workspaceId,
            externalListingId: listingId,
          },
        });

        if (listing) {
          listing.externalStatus =
            typeof payload.topic === 'string' ? payload.topic : listing.externalStatus;
          await this.listingsRepository.save(listing);
        }
      }
    }
  }

  async importOrdersForAccount(input: { accountId: string; workspaceId: string }) {
    const account = await this.loadAccount(input.accountId);
    const orders = await this.fetchOrders({
      accountExternalId: account.externalId,
    });

    for (const externalOrder of orders) {
      const exists = await this.ordersRepository.findOne({
        where: {
          workspaceId: input.workspaceId,
          accountId: account.id,
          externalOrderId: externalOrder.externalOrderId,
        },
      });

      if (exists) {
        continue;
      }

      const order = await this.ordersRepository.save(
        this.ordersRepository.create({
          workspaceId: input.workspaceId,
          accountId: account.id,
          channelId: account.channelId,
          externalOrderId: externalOrder.externalOrderId,
          orderNumber: externalOrder.orderNumber,
          status: 'pending' as never,
          externalStatus: externalOrder.status,
          currency: externalOrder.currency ?? account.currency,
          customerName: externalOrder.customerName,
          customerEmail: externalOrder.customerEmail,
          totalAmount: String(externalOrder.totalAmount),
          importedAt: new Date(),
          rawPayload: externalOrder.rawPayload ?? externalOrder,
        }),
      );

      if (externalOrder.items.length > 0) {
        const externalItemIds = externalOrder.items
          .map((item) => item.externalItemId)
          .filter((value): value is string => Boolean(value));
        const skus = externalOrder.items
          .map((item) => item.externalSku)
          .filter((value): value is string => Boolean(value));
        const listings = externalItemIds.length
          ? await this.listingsRepository.find({
              where: {
                workspaceId: input.workspaceId,
                accountId: account.id,
                externalListingId: In(externalItemIds),
              },
            })
          : [];
        const variants = skus.length
          ? await this.variantsRepository.find({
              where: {
                workspaceId: input.workspaceId,
                sku: In(skus),
              },
            })
          : [];
        const listingsByExternalItemId = new Map(
          listings.map((listing) => [listing.externalListingId, listing]),
        );
        const variantsBySku = new Map(variants.map((variant) => [variant.sku, variant]));

        for (const item of externalOrder.items) {
          const variant = item.externalSku ? variantsBySku.get(item.externalSku) : undefined;
          const listing = item.externalItemId
            ? listingsByExternalItemId.get(item.externalItemId)
            : undefined;
          await this.orderItemsRepository.save(
            this.orderItemsRepository.create({
              workspaceId: input.workspaceId,
              orderId: order.id,
              listingId: listing?.id,
              variantId: variant?.id,
              externalItemId: item.externalItemId,
              externalSku: item.externalSku,
              title: item.title,
              quantity: item.quantity,
              currency: item.currency ?? order.currency,
              unitPrice: String(item.unitPrice),
              totalAmount: String(item.totalAmount ?? item.quantity * item.unitPrice),
            }),
          );
        }
      }
    }

    await this.syncLogsService.create({
      workspaceId: input.workspaceId,
      accountId: account.id,
      action: 'import_orders',
      status: 'completed',
      message: 'Mercado Libre orders imported',
      payloadSummary: {
        importedCount: orders.length,
      },
    });

    return {
      importedCount: orders.length,
    };
  }

  private async fetchListingIds(accountExternalId: string, accessToken: string) {
    const response = await this.apiClient.request<MercadoLibreItemSearchResponse>(
      `/users/${accountExternalId}/items/search`,
      {
        method: 'GET',
        accessToken,
        query: {
          limit: 100,
        },
      },
    );

    return response.results;
  }

  private async loadAccount(accountId: string) {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
      relations: { channel: true },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    return account;
  }
}
