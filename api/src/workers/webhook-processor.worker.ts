import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { syncQueueNames } from '../modules/sync-jobs/sync-jobs.constants.js';
import { SyncLoggingPolicy } from '../modules/sync-jobs/sync-logging.policy.js';
import { SyncRetryPolicy } from '../modules/sync-jobs/sync-retry.policy.js';
import { SyncJobsService } from '../modules/sync-jobs/sync-jobs.service.js';
import { BaseSyncProcessor } from './base-sync.processor.js';
import type { WebhookProcessingPayload } from './types/sync-job-payloads.js';
import { WebhookProcessingService } from './webhook-processing.service.js';

@Processor(syncQueueNames.process_webhook)
export class WebhookProcessorWorker extends WorkerHost {
  private readonly baseProcessor: BaseSyncProcessor;

  constructor(
    syncJobsService: SyncJobsService,
    syncLoggingPolicy: SyncLoggingPolicy,
    syncRetryPolicy: SyncRetryPolicy,
    private readonly webhookProcessingService: WebhookProcessingService,
  ) {
    super();
    this.baseProcessor = new BaseSyncProcessor(syncJobsService, syncLoggingPolicy, syncRetryPolicy);
  }

  process(job: Job<WebhookProcessingPayload>) {
    return this.baseProcessor.runJob(job, (payload) =>
      this.webhookProcessingService.execute(payload),
    );
  }
}
