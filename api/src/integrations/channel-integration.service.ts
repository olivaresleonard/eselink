import { Injectable, NotFoundException } from '@nestjs/common';
import { PlatformCode } from '../common/entities/domain.enums.js';
import type { ChannelIntegrationService } from './channel-integration.interface.js';
import { MercadoLibreService } from './mercadolibre/mercadolibre.service.js';
import { ShopifyService } from './shopify/shopify.service.js';
import { WooCommerceService } from './woocommerce/woocommerce.service.js';

@Injectable()
export class ChannelIntegrationResolverService {
  constructor(
    private readonly mercadoLibreService: MercadoLibreService,
    private readonly shopifyService: ShopifyService,
    private readonly wooCommerceService: WooCommerceService,
  ) {}

  resolve(platform: PlatformCode): ChannelIntegrationService {
    switch (platform) {
      case PlatformCode.MERCADOLIBRE:
        return this.mercadoLibreService;
      case PlatformCode.SHOPIFY:
        return this.shopifyService;
      case PlatformCode.WOOCOMMERCE:
        return this.wooCommerceService;
      default:
        throw new NotFoundException(`No integration available for ${platform}`);
    }
  }
}
