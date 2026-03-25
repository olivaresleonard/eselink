import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelIntegrationResolverService } from '../integrations/channel-integration.service.js';
import { Account } from '../modules/accounts/account.entity.js';
import { Listing } from '../modules/listings/listing.entity.js';
import type { PriceSyncPayload } from './types/sync-job-payloads.js';

@Injectable()
export class PriceSyncService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    private readonly integrationResolver: ChannelIntegrationResolverService,
  ) {}

  async execute(data: PriceSyncPayload) {
    const listings = await this.listingsRepository.find({
      where: {
        workspaceId: data.workspaceId,
      },
      relations: {
        account: { channel: true },
        variant: true,
      },
    });

    const filtered = listings.filter(
      (listing) =>
        listing.id === data.entityId ||
        listing.variantId === data.entityId ||
        listing.productId === data.entityId,
    );

    for (const listing of filtered) {
      const nextPrice =
        typeof data.payload.price === 'number'
          ? data.payload.price
          : Number(listing.price ?? listing.variant?.price ?? 0);

      const integration = this.integrationResolver.resolve(listing.account.channel.code);
      await integration.updatePrice({
        accountExternalId: listing.account.externalId,
        externalListingId: listing.externalListingId,
        externalSku: listing.externalSku ?? listing.variant?.sku,
        price: nextPrice,
        currency: listing.currency,
        payload: data.payload,
      });

      listing.price = String(nextPrice);
      listing.lastPriceSyncAt = new Date();
      await this.listingsRepository.save(listing);
    }

    if (data.accountId) {
      const account = await this.accountsRepository.findOne({ where: { id: data.accountId } });
      if (!account) {
        throw new NotFoundException(`Account ${data.accountId} not found`);
      }
      account.lastPriceSyncAt = new Date();
      account.lastSyncAt = new Date();
      await this.accountsRepository.save(account);
    }
  }
}
