import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsModule } from '../../integrations/integrations.module.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { ProductVariantsModule } from '../product-variants/product-variants.module.js';
import { SkuMappingsModule } from '../sku-mappings/sku-mappings.module.js';
import { SyncJobsModule } from '../sync-jobs/sync-jobs.module.js';
import { Account } from '../accounts/account.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { SkuMapping } from '../sku-mappings/sku-mapping.entity.js';
import { Listing } from './listing.entity.js';
import { ListingsController } from './listings.controller.js';
import { ListingsRepository } from './listings.repository.js';
import { ListingsService } from './listings.service.js';
import { ListingPublisherStrategy } from './publishers/listing-publisher.strategy.js';
import { MercadoLibreListingPublisher } from './publishers/mercadolibre-listing.publisher.js';
import { ShopifyListingPublisher } from './publishers/shopify-listing.publisher.js';
import { WooCommerceListingPublisher } from './publishers/woocommerce-listing.publisher.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Listing, ProductVariant, Account, SkuMapping]),
    IntegrationsModule,
    SyncJobsModule,
    AccountsModule,
    ProductVariantsModule,
    SkuMappingsModule,
  ],
  controllers: [ListingsController],
  providers: [
    ListingsRepository,
    ListingsService,
    ListingPublisherStrategy,
    MercadoLibreListingPublisher,
    ShopifyListingPublisher,
    WooCommerceListingPublisher,
  ],
  exports: [ListingsService],
})
export class ListingsModule {}
