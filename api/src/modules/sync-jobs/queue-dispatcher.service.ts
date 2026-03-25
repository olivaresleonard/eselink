import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { SyncJob } from './sync-job.entity.js';
import type { BaseSyncJobPayload } from './sync-job-payload.interfaces.js';
import { syncQueueNames, type SyncQueueName } from './sync-jobs.constants.js';
import { SyncRetryPolicy } from './sync-retry.policy.js';

@Injectable()
export class QueueDispatcherService {
  constructor(
    @InjectQueue(syncQueueNames.import_orders)
    private readonly ordersImportQueue: Queue,
    @InjectQueue(syncQueueNames.sync_inventory)
    private readonly inventorySyncQueue: Queue,
    @InjectQueue(syncQueueNames.sync_price)
    private readonly priceSyncQueue: Queue,
    @InjectQueue(syncQueueNames.publish_listing)
    private readonly listingSyncQueue: Queue,
    @InjectQueue(syncQueueNames.process_webhook)
    private readonly webhookQueue: Queue,
    private readonly syncRetryPolicy: SyncRetryPolicy,
  ) {}

  private queueFor(type: SyncQueueName) {
    return {
      [syncQueueNames.import_orders]: this.ordersImportQueue,
      [syncQueueNames.sync_inventory]: this.inventorySyncQueue,
      [syncQueueNames.sync_price]: this.priceSyncQueue,
      [syncQueueNames.publish_listing]: this.listingSyncQueue,
      [syncQueueNames.process_webhook]: this.webhookQueue,
    }[type];
  }

  async dispatch(syncJob: SyncJob, payload: Record<string, unknown> | null | undefined) {
    const queueName = syncJob.queueName as SyncQueueName;
    const jobPayload: BaseSyncJobPayload = {
      syncJobId: syncJob.id,
      workspaceId: syncJob.workspaceId,
      accountId: syncJob.accountId ?? undefined,
      type: syncJob.type,
      entityType: syncJob.entityType,
      entityId: syncJob.entityId,
      payload: payload ?? {},
      attempts: this.syncRetryPolicy.resolveAttempts(syncJob.maxAttempts),
    };

    await this.queueFor(queueName).add(
      syncJob.id,
      jobPayload,
      this.syncRetryPolicy.buildQueueOptions(syncJob.maxAttempts, syncJob.priority),
    );
  }
}
