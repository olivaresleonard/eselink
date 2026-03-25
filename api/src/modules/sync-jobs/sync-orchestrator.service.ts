import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InventoryItem } from '../inventory/inventory-item.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { WebhookEvent } from '../webhooks/webhook-event.entity.js';
import { SyncJobsService } from './sync-jobs.service.js';

@Injectable()
export class SyncOrchestratorService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemsRepository: Repository<InventoryItem>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventsRepository: Repository<WebhookEvent>,
    private readonly syncJobsService: SyncJobsService,
  ) {}

  async scheduleInventorySyncForVariant(data: {
    workspaceId: string;
    variantId: string;
    accountId?: string;
    reason?: string;
    dryRun?: boolean;
  }) {
    const variant = await this.variantsRepository.findOne({
      where: {
        id: data.variantId,
        workspaceId: data.workspaceId,
      },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant ${data.variantId} not found`);
    }

    const listings = await this.listingsRepository.find({
      where: {
        workspaceId: data.workspaceId,
        variantId: data.variantId,
        ...(data.accountId ? { accountId: data.accountId } : {}),
      },
    });

    const inventoryItems = await this.inventoryItemsRepository.find({
      where: {
        workspaceId: data.workspaceId,
        variantId: data.variantId,
      },
    });

    const availableStock = inventoryItems.reduce((sum, item) => sum + item.available, 0);

    return Promise.all(
      listings.map((listing) =>
        this.syncJobsService.create({
          workspaceId: listing.workspaceId,
          accountId: listing.accountId,
          type: 'sync_inventory',
          entityType: 'listing',
          entityId: listing.id,
          payload: {
            listingIds: [listing.id],
            variantIds: [data.variantId],
            availableStock,
            dryRun: data.dryRun ?? false,
            reason: data.reason ?? 'inventory changed',
          },
        }),
      ),
    );
  }

  async schedulePriceSyncForVariant(data: {
    workspaceId: string;
    variantId: string;
    accountId?: string;
    price?: number;
    reason?: string;
  }) {
    const variant = await this.variantsRepository.findOne({
      where: {
        id: data.variantId,
        workspaceId: data.workspaceId,
      },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant ${data.variantId} not found`);
    }

    const listings = await this.listingsRepository.find({
      where: {
        workspaceId: data.workspaceId,
        variantId: data.variantId,
        ...(data.accountId ? { accountId: data.accountId } : {}),
      },
    });

    const resolvedPrice = data.price ?? Number(variant.price);

    return Promise.all(
      listings.map((listing) =>
        this.syncJobsService.create({
          workspaceId: listing.workspaceId,
          accountId: listing.accountId,
          type: 'sync_price',
          entityType: 'listing',
          entityId: listing.id,
          payload: {
            listingIds: [listing.id],
            variantIds: [data.variantId],
            price: resolvedPrice,
            reason: data.reason ?? 'price changed',
          },
        }),
      ),
    );
  }

  scheduleInventorySync(data: {
    workspaceId: string;
    accountId: string;
    entityId: string;
    listingIds?: string[];
    variantIds?: string[];
    reason?: string;
  }) {
    return this.syncJobsService.create({
      workspaceId: data.workspaceId,
      accountId: data.accountId,
      type: 'sync_inventory',
      entityType: 'account',
      entityId: data.entityId,
      payload: {
        listingIds: data.listingIds,
        variantIds: data.variantIds,
        reason: data.reason ?? 'manual inventory sync',
      },
    });
  }

  schedulePriceSync(data: {
    workspaceId: string;
    accountId: string;
    entityId: string;
    price?: number;
    listingIds?: string[];
    variantIds?: string[];
    reason?: string;
  }) {
    return this.syncJobsService.create({
      workspaceId: data.workspaceId,
      accountId: data.accountId,
      type: 'sync_price',
      entityType: 'account',
      entityId: data.entityId,
      payload: {
        price: data.price,
        listingIds: data.listingIds,
        variantIds: data.variantIds,
        reason: data.reason ?? 'manual price sync',
      },
    });
  }

  scheduleListingPublish(data: {
    workspaceId: string;
    accountId: string;
    listingId: string;
    productVariantId?: string;
    title?: string;
    price?: number;
    stock?: number;
    sku?: string;
    currency?: string;
    reason?: string;
  }) {
    return this.syncJobsService.create({
      workspaceId: data.workspaceId,
      accountId: data.accountId,
      type: 'publish_listing',
      entityType: 'listing',
      entityId: data.listingId,
      payload: {
        productVariantId: data.productVariantId,
        title: data.title,
        price: data.price,
        stock: data.stock,
        sku: data.sku,
        currency: data.currency,
        reason: data.reason ?? 'listing publish requested',
      },
    });
  }

  scheduleOrdersImport(data: {
    workspaceId: string;
    accountId: string;
    fromDate?: string;
    toDate?: string;
    reason?: string;
  }) {
    return this.syncJobsService.create({
      workspaceId: data.workspaceId,
      accountId: data.accountId,
      type: 'import_orders',
      entityType: 'account',
      entityId: data.accountId,
      payload: {
        fromDate: data.fromDate,
        toDate: data.toDate,
        reason: data.reason ?? 'manual orders import',
      },
    });
  }

  async scheduleWebhookProcessing(data: {
    workspaceId: string;
    webhookEventId: string;
    accountId?: string;
    reason?: string;
  }) {
    const event = await this.webhookEventsRepository.findOne({
      where: {
        id: data.webhookEventId,
        workspaceId: data.workspaceId,
      },
    });

    if (!event) {
      throw new NotFoundException(`Webhook event ${data.webhookEventId} not found`);
    }

    return this.syncJobsService.create({
      workspaceId: data.workspaceId,
      accountId: data.accountId ?? event.accountId ?? undefined,
      type: 'process_webhook',
      entityType: 'webhook_event',
      entityId: event.id,
      payload: {
        ...event.payload,
        reason: data.reason ?? 'webhook received',
      },
    });
  }

  async scheduleInventorySyncForListings(data: {
    workspaceId: string;
    listingIds: string[];
    reason?: string;
  }) {
    const listings = await this.listingsRepository.find({
      where: {
        workspaceId: data.workspaceId,
        id: In(data.listingIds),
      },
    });

    return Promise.all(
      listings.map((listing) =>
        this.syncJobsService.create({
          workspaceId: listing.workspaceId,
          accountId: listing.accountId,
          type: 'sync_inventory',
          entityType: 'listing',
          entityId: listing.id,
          payload: {
            listingIds: [listing.id],
            variantIds: listing.variantId ? [listing.variantId] : [],
            reason: data.reason ?? 'listing stock sync requested',
          },
        }),
      ),
    );
  }
}
