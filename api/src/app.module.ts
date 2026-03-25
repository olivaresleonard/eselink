import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppController } from './app.controller.js';
import { OperationContextModule } from './core/operation-context/operation-context.module.js';
import { DatabaseModule } from './database/database.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AccountConnectionsModule } from './modules/account-connections/account-connections.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChannelsModule } from './modules/channels/channels.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { InventoryMovementsModule } from './modules/inventory-movements/inventory-movements.module.js';
import { ListingsModule } from './modules/listings/listings.module.js';
import { MessagesModule } from './modules/messages/messages.module.js';
import { OrderAssignmentsModule } from './modules/order-assignments/order-assignments.module.js';
import { OrderCommentsModule } from './modules/order-comments/order-comments.module.js';
import { OrderEventsModule } from './modules/order-events/order-events.module.js';
import { OrderItemsModule } from './modules/order-items/order-items.module.js';
import { OrderTagsModule } from './modules/order-tags/order-tags.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { ProductVariantsModule } from './modules/product-variants/product-variants.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SkuMappingsModule } from './modules/sku-mappings/sku-mappings.module.js';
import { SyncJobsModule } from './modules/sync-jobs/sync-jobs.module.js';
import { SyncLogsModule } from './modules/sync-logs/sync-logs.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { WebhooksModule } from './modules/webhooks/webhooks.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { WorkspaceUsersModule } from './modules/workspace-users/workspace-users.module.js';
import { QueueModule } from './queues/queue.module.js';
import { WorkersModule } from './workers/workers.module.js';

const envFileCandidates = [
  resolve(process.cwd(), '.env'),
].filter((filePath, index, files) => files.indexOf(filePath) === index && existsSync(filePath));

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: envFileCandidates,
    }),
    OperationContextModule,
    DatabaseModule,
    QueueModule,
    IntegrationsModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    WorkspaceUsersModule,
    ChannelsModule,
    AccountsModule,
    AccountConnectionsModule,
    ProductsModule,
    ProductVariantsModule,
    SkuMappingsModule,
    ListingsModule,
    MessagesModule,
    InventoryModule,
    InventoryMovementsModule,
    OrdersModule,
    OrderItemsModule,
    OrderEventsModule,
    OrderAssignmentsModule,
    OrderCommentsModule,
    OrderTagsModule,
    WebhooksModule,
    SyncJobsModule,
    SyncLogsModule,
    ReportsModule,
    AuditModule,
    WorkersModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
