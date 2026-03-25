import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListingStatus } from '../common/entities/domain.enums.js';
import { ChannelIntegrationResolverService } from '../integrations/channel-integration.service.js';
import { Listing } from '../modules/listings/listing.entity.js';
import type { ListingSyncPayload } from './types/sync-job-payloads.js';

@Injectable()
export class ListingSyncService {
  constructor(
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    private readonly integrationResolver: ChannelIntegrationResolverService,
  ) {}

  async execute(data: ListingSyncPayload) {
    const listing = await this.listingsRepository.findOne({
      where: { id: data.entityId, workspaceId: data.workspaceId },
      relations: {
        account: { channel: true },
        variant: true,
      },
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${data.entityId} not found`);
    }

    const integration = this.integrationResolver.resolve(listing.account.channel.code);
    const result = await integration.publishListing({
      accountExternalId: listing.account.externalId,
      listingId: listing.id,
      title: listing.title,
      externalSku: listing.externalSku ?? listing.variant?.sku,
      price: listing.price ? Number(listing.price) : null,
      availableStock: listing.stock,
      payload: data.payload,
    });

    listing.status = ListingStatus.PUBLISHED;
    listing.externalListingId =
      typeof result.externalId === 'string' ? result.externalId : listing.externalListingId;
    listing.externalSku =
      typeof result.externalSku === 'string' ? result.externalSku : listing.externalSku;
    listing.permalink =
      typeof result.permalink === 'string' ? result.permalink : listing.permalink;
    listing.lastPublishedAt = new Date();
    await this.listingsRepository.save(listing);
  }
}
