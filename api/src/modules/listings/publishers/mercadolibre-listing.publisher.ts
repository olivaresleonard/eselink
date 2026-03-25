import { Injectable } from '@nestjs/common';
import { PlatformCode } from '../../../common/entities/domain.enums.js';
import { MercadoLibreService } from '../../../integrations/mercadolibre/mercadolibre.service.js';
import { ListingPublisher } from './listing-publisher.interface.js';

@Injectable()
export class MercadoLibreListingPublisher implements ListingPublisher {
  constructor(private readonly mercadoLibreService: MercadoLibreService) {}

  supports(channelCode: string) {
    return channelCode === PlatformCode.MERCADOLIBRE;
  }

  importExistingListings(input: { workspaceId: string; accountId: string }) {
    return this.mercadoLibreService.importListings(input);
  }
}
