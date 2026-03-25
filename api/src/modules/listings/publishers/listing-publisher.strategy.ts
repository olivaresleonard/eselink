import { Injectable, NotFoundException } from '@nestjs/common';
import { MercadoLibreListingPublisher } from './mercadolibre-listing.publisher.js';
import { ShopifyListingPublisher } from './shopify-listing.publisher.js';
import { WooCommerceListingPublisher } from './woocommerce-listing.publisher.js';

@Injectable()
export class ListingPublisherStrategy {
  constructor(
    private readonly mercadoLibrePublisher: MercadoLibreListingPublisher,
    private readonly shopifyPublisher: ShopifyListingPublisher,
    private readonly wooCommercePublisher: WooCommerceListingPublisher,
  ) {}

  resolve(channelCode: string) {
    const publisher = [
      this.mercadoLibrePublisher,
      this.shopifyPublisher,
      this.wooCommercePublisher,
    ].find((candidate) => candidate.supports(channelCode));

    if (!publisher) {
      throw new NotFoundException(`No listing publisher available for ${channelCode}`);
    }

    return publisher;
  }
}
