import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ListingStatus } from '../common/entities/domain.enums.js';
import { ChannelIntegrationResolverService } from '../integrations/channel-integration.service.js';
import { Account } from '../modules/accounts/account.entity.js';
import { InventoryItem } from '../modules/inventory/inventory-item.entity.js';
import { Listing } from '../modules/listings/listing.entity.js';
import type { InventorySyncPayload } from './types/sync-job-payloads.js';

@Injectable()
export class InventorySyncService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemsRepository: Repository<InventoryItem>,
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    private readonly integrationResolver: ChannelIntegrationResolverService,
  ) {}

  async execute(data: InventorySyncPayload) {
    const variantIds = Array.isArray(data.payload.variantIds)
      ? data.payload.variantIds.filter((value): value is string => typeof value === 'string')
      : [];

    const listingIds = Array.isArray(data.payload.listingIds)
      ? data.payload.listingIds.filter((value): value is string => typeof value === 'string')
      : [];

    const listings = await this.listingsRepository.find({
      where: {
        workspaceId: data.workspaceId,
        ...(data.accountId ? { accountId: data.accountId } : {}),
        ...(listingIds.length ? { id: In(listingIds) } : {}),
        ...(variantIds.length ? { variantId: In(variantIds) } : {}),
        status: In([ListingStatus.PUBLISHED, ListingStatus.PAUSED]),
      },
      relations: {
        account: { channel: true },
        variant: true,
      },
    });

    for (const listing of listings) {
      if (!listing.variantId) {
        continue;
      }

      const inventoryItems = await this.inventoryItemsRepository.find({
        where: {
          workspaceId: data.workspaceId,
          variantId: listing.variantId,
        },
      });

      const availableStock = inventoryItems.reduce((sum, item) => sum + item.available, 0);
      const integration = this.integrationResolver.resolve(listing.account.channel.code);

      await integration.updateStock({
        accountExternalId: listing.account.externalId,
        externalListingId: listing.externalListingId,
        externalSku: listing.externalSku ?? listing.variant?.sku,
        availableStock,
        payload: data.payload,
      });

      listing.stock = availableStock;
      listing.lastInventorySyncAt = new Date();
      await this.listingsRepository.save(listing);
    }

    if (data.accountId) {
      const account = await this.accountsRepository.findOne({ where: { id: data.accountId } });
      if (!account) {
        throw new NotFoundException(`Account ${data.accountId} not found`);
      }
      account.lastStockSyncAt = new Date();
      account.lastSyncAt = new Date();
      await this.accountsRepository.save(account);
    }
  }
}
