import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { Account } from '../modules/accounts/account.entity.js';
import { InventoryItem } from '../modules/inventory/inventory-item.entity.js';
import { InventoryMovement } from '../modules/inventory-movements/inventory-movement.entity.js';
import { Listing } from '../modules/listings/listing.entity.js';
import { OrderEvent } from '../modules/order-events/order-event.entity.js';
import { OrderItem } from '../modules/order-items/order-item.entity.js';
import { OrdersModule } from '../modules/orders/orders.module.js';
import { Order } from '../modules/orders/order.entity.js';
import { ProductVariant } from '../modules/product-variants/product-variant.entity.js';
import { WebhookEvent } from '../modules/webhooks/webhook-event.entity.js';
import { SyncJobsModule } from '../modules/sync-jobs/sync-jobs.module.js';
import { SyncLogsModule } from '../modules/sync-logs/sync-logs.module.js';
import { InventorySyncService } from './inventory-sync.service.js';
import { InventorySyncWorker } from './inventory-sync.worker.js';
import { ListingSyncService } from './listing-sync.service.js';
import { ListingSyncWorker } from './listing-sync.worker.js';
import { OrdersImportService as SyncOrdersImportService } from './orders-import.service.js';
import { OrdersImportWorker } from './orders-import.worker.js';
import { PriceSyncService } from './price-sync.service.js';
import { PriceSyncWorker } from './price-sync.worker.js';
import { WebhookProcessingService } from './webhook-processing.service.js';
import { WebhookProcessorWorker } from './webhook-processor.worker.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Account,
      InventoryItem,
      InventoryMovement,
      Listing,
      Order,
      OrderItem,
      OrderEvent,
      ProductVariant,
      WebhookEvent,
    ]),
    IntegrationsModule,
    OrdersModule,
    SyncJobsModule,
    SyncLogsModule,
  ],
  providers: [
    SyncOrdersImportService,
    OrdersImportWorker,
    InventorySyncService,
    InventorySyncWorker,
    PriceSyncService,
    PriceSyncWorker,
    ListingSyncService,
    ListingSyncWorker,
    WebhookProcessingService,
    WebhookProcessorWorker,
  ],
})
export class WorkersModule {}
