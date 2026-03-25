import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { syncQueueNames } from '../modules/sync-jobs/sync-jobs.constants.js';
import { SyncLoggingPolicy } from '../modules/sync-jobs/sync-logging.policy.js';
import { SyncRetryPolicy } from '../modules/sync-jobs/sync-retry.policy.js';
import { SyncJobsService } from '../modules/sync-jobs/sync-jobs.service.js';
import { BaseSyncProcessor } from './base-sync.processor.js';
import { ListingSyncService } from './listing-sync.service.js';
import type { ListingSyncPayload } from './types/sync-job-payloads.js';

@Processor(syncQueueNames.publish_listing)
export class ListingSyncWorker extends WorkerHost {
  private readonly baseProcessor: BaseSyncProcessor;

  constructor(
    syncJobsService: SyncJobsService,
    syncLoggingPolicy: SyncLoggingPolicy,
    syncRetryPolicy: SyncRetryPolicy,
    private readonly listingSyncService: ListingSyncService,
  ) {
    super();
    this.baseProcessor = new BaseSyncProcessor(syncJobsService, syncLoggingPolicy, syncRetryPolicy);
  }

  process(job: Job<ListingSyncPayload>) {
    return this.baseProcessor.runJob(job, (payload) =>
      this.listingSyncService.execute(payload),
    );
  }
}
