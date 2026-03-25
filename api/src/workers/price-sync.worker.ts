import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { syncQueueNames } from '../modules/sync-jobs/sync-jobs.constants.js';
import { SyncLoggingPolicy } from '../modules/sync-jobs/sync-logging.policy.js';
import { SyncRetryPolicy } from '../modules/sync-jobs/sync-retry.policy.js';
import { SyncJobsService } from '../modules/sync-jobs/sync-jobs.service.js';
import { BaseSyncProcessor } from './base-sync.processor.js';
import { PriceSyncService } from './price-sync.service.js';
import type { PriceSyncPayload } from './types/sync-job-payloads.js';

@Processor(syncQueueNames.sync_price)
export class PriceSyncWorker extends WorkerHost {
  private readonly baseProcessor: BaseSyncProcessor;

  constructor(
    syncJobsService: SyncJobsService,
    syncLoggingPolicy: SyncLoggingPolicy,
    syncRetryPolicy: SyncRetryPolicy,
    private readonly priceSyncService: PriceSyncService,
  ) {
    super();
    this.baseProcessor = new BaseSyncProcessor(syncJobsService, syncLoggingPolicy, syncRetryPolicy);
  }

  process(job: Job<PriceSyncPayload>) {
    return this.baseProcessor.runJob(job, (payload) =>
      this.priceSyncService.execute(payload),
    );
  }
}
