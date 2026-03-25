import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountConnection } from '../../modules/account-connections/account-connection.entity.js';
import { Account } from '../../modules/accounts/account.entity.js';
import { Channel } from '../../modules/channels/channel.entity.js';
import { InventoryItem } from '../../modules/inventory/inventory-item.entity.js';
import { Listing } from '../../modules/listings/listing.entity.js';
import { OrderEvent } from '../../modules/order-events/order-event.entity.js';
import { OrderItem } from '../../modules/order-items/order-item.entity.js';
import { Order } from '../../modules/orders/order.entity.js';
import { ProductVariant } from '../../modules/product-variants/product-variant.entity.js';
import { Product } from '../../modules/products/product.entity.js';
import { SkuMapping } from '../../modules/sku-mappings/sku-mapping.entity.js';
import { SyncLogsModule } from '../../modules/sync-logs/sync-logs.module.js';
import { WebhookEvent } from '../../modules/webhooks/webhook-event.entity.js';
import { MercadoLibreApiClient } from './mercadolibre-api.client.js';
import { MercadoLibreAuthService } from './mercadolibre-auth.service.js';
import { MercadoLibreClient } from './mercadolibre.client.js';
import { MercadoLibreMapper } from './mercadolibre.mapper.js';
import { MercadoLibreOrdersService } from './mercadolibre.orders.service.js';
import { MercadoLibreService } from './mercadolibre.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      AccountConnection,
      Channel,
      InventoryItem,
      Listing,
      Order,
      OrderItem,
      OrderEvent,
      Product,
      ProductVariant,
      SkuMapping,
      WebhookEvent,
    ]),
    SyncLogsModule,
  ],
  providers: [
    MercadoLibreApiClient,
    MercadoLibreClient,
    MercadoLibreAuthService,
    MercadoLibreMapper,
    MercadoLibreOrdersService,
    MercadoLibreService,
  ],
  exports: [
    MercadoLibreApiClient,
    MercadoLibreClient,
    MercadoLibreAuthService,
    MercadoLibreMapper,
    MercadoLibreOrdersService,
    MercadoLibreService,
  ],
})
export class MercadoLibreModule {}
