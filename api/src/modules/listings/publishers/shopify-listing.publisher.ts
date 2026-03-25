import { Injectable } from '@nestjs/common';
import { PlatformCode } from '../../../common/entities/domain.enums.js';
import { ListingPublisher } from './listing-publisher.interface.js';

@Injectable()
export class ShopifyListingPublisher implements ListingPublisher {
  supports(channelCode: string) {
    return channelCode === PlatformCode.SHOPIFY;
  }

  async importExistingListings(_input: { workspaceId: string; accountId: string }) {
    return {
      importedCount: 0,
      imported: [],
    };
  }
}
