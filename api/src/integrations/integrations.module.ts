import { Module } from '@nestjs/common';
import { ChannelIntegrationResolverService } from './channel-integration.service.js';
import { MercadoLibreModule } from './mercadolibre/mercadolibre.module.js';
import { MercadoLibreService } from './mercadolibre/mercadolibre.service.js';
import { ShopifyService } from './shopify/shopify.service.js';
import { WooCommerceService } from './woocommerce/woocommerce.service.js';

@Module({
  imports: [MercadoLibreModule],
  providers: [
    ChannelIntegrationResolverService,
    ShopifyService,
    WooCommerceService,
  ],
  exports: [
    ChannelIntegrationResolverService,
    MercadoLibreModule,
  ],
})
export class IntegrationsModule {}
