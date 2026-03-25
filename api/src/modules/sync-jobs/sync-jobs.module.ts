import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '../inventory/inventory-item.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { SyncLogsModule } from '../sync-logs/sync-logs.module.js';
import { WebhookEvent } from '../webhooks/webhook-event.entity.js';
import { QueueDispatcherService } from './queue-dispatcher.service.js';
import { syncQueueNames } from './sync-jobs.constants.js';
import { SyncJobsController } from './sync-jobs.controller.js';
import { SyncJob } from './sync-job.entity.js';
import { SyncLoggingPolicy } from './sync-logging.policy.js';
import { SyncOrchestratorService } from './sync-orchestrator.service.js';
import { SyncRetryPolicy } from './sync-retry.policy.js';
import { SyncJobsRepository } from './sync-jobs.repository.js';
import { SyncJobsService } from './sync-jobs.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SyncJob, Listing, InventoryItem, ProductVariant, WebhookEvent]),
    SyncLogsModule,
    BullModule.registerQueue(
      { name: syncQueueNames.import_orders },
      { name: syncQueueNames.sync_inventory },
      { name: syncQueueNames.sync_price },
      { name: syncQueueNames.publish_listing },
      { name: syncQueueNames.process_webhook },
    ),
  ],
  providers: [
    SyncJobsRepository,
    SyncRetryPolicy,
    QueueDispatcherService,
    SyncJobsService,
    SyncLoggingPolicy,
    SyncOrchestratorService,
  ],
  controllers: [SyncJobsController],
  exports: [SyncJobsService, SyncRetryPolicy, QueueDispatcherService, SyncLoggingPolicy, SyncOrchestratorService],
})
export class SyncJobsModule {}
