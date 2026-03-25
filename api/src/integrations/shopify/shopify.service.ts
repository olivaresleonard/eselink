import { Injectable } from '@nestjs/common';
import { PlatformCode } from '../../common/entities/domain.enums.js';
import {
  ChannelIntegrationService,
  type NormalizedOrder,
} from '../channel-integration.interface.js';

@Injectable()
export class ShopifyService implements ChannelIntegrationService {
  readonly platform = PlatformCode.SHOPIFY;

  async updateStock(input: {
    accountExternalId: string;
    externalListingId?: string | null;
    externalSku?: string | null;
    availableStock: number;
  }) {
    return { provider: this.platform, ...input, syncedAt: new Date().toISOString() };
  }

  async updatePrice(input: {
    accountExternalId: string;
    externalListingId?: string | null;
    externalSku?: string | null;
    price: number;
    currency?: string;
  }) {
    return { provider: this.platform, ...input, syncedAt: new Date().toISOString() };
  }

  async publishListing(input: {
    accountExternalId: string;
    listingId: string;
    title: string;
    externalSku?: string | null;
    price?: number | null;
    availableStock?: number | null;
  }) {
    return {
      provider: this.platform,
      externalId: `shopify-${input.listingId}`,
      externalSku: input.externalSku,
      permalink: `https://shopify.example/products/${input.listingId}`,
    };
  }

  async fetchOrders(_input: {
    accountExternalId: string;
    payload?: Record<string, unknown>;
  }): Promise<NormalizedOrder[]> {
    return [];
  }
}
