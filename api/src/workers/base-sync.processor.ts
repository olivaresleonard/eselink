import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { SyncJobStatus } from '../common/entities/domain.enums.js';
import { SyncLoggingPolicy } from '../modules/sync-jobs/sync-logging.policy.js';
import { SyncRetryPolicy } from '../modules/sync-jobs/sync-retry.policy.js';
import { SyncJobsService } from '../modules/sync-jobs/sync-jobs.service.js';
import type { BaseSyncJobPayload } from './types/sync-job-payloads.js';

export class BaseSyncProcessor {
  protected readonly logger = new Logger(BaseSyncProcessor.name);

  constructor(
    protected readonly syncJobsService: SyncJobsService,
    protected readonly syncLoggingPolicy: SyncLoggingPolicy,
    protected readonly syncRetryPolicy: SyncRetryPolicy,
  ) {}

  async runJob<T extends BaseSyncJobPayload>(
    job: Job<T>,
    handler: (payload: T) => Promise<void>,
  ) {
    const syncJob = await this.syncJobsService.findTrackedJobOrFail(job.data.syncJobId);
    await this.syncJobsService.updateTrackedJob(syncJob.id, {
      status: SyncJobStatus.PROCESSING,
      attempts: job.attemptsMade + 1,
      startedAt: new Date(),
      lastError: null,
    });

    await this.syncLoggingPolicy.logProcessing({
      workspaceId: syncJob.workspaceId,
      accountId: syncJob.accountId ?? null,
      syncJobId: syncJob.id,
      action: syncJob.type,
      entityType: syncJob.entityType,
      entityId: syncJob.entityId,
      attempt: job.attemptsMade + 1,
    });

    try {
      await handler(job.data);

      await this.syncJobsService.updateTrackedJob(syncJob.id, {
        status: SyncJobStatus.COMPLETED,
        finishedAt: new Date(),
      });

      await this.syncLoggingPolicy.logCompleted({
        workspaceId: syncJob.workspaceId,
        accountId: syncJob.accountId ?? null,
        syncJobId: syncJob.id,
        action: syncJob.type,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker error';
      const maxAttempts = job.opts.attempts ?? syncJob.maxAttempts;
      const currentAttempt = job.attemptsMade + 1;
      const finalAttempt = this.syncRetryPolicy.isFinalAttempt(currentAttempt, maxAttempts);

      await this.syncJobsService.updateTrackedJob(syncJob.id, {
        status: finalAttempt ? SyncJobStatus.FAILED : SyncJobStatus.PENDING,
        attempts: currentAttempt,
        lastError: message,
        finishedAt: finalAttempt ? new Date() : null,
      });

      await this.syncLoggingPolicy.logFailure({
        workspaceId: syncJob.workspaceId,
        accountId: syncJob.accountId ?? null,
        syncJobId: syncJob.id,
        action: syncJob.type,
        attempt: currentAttempt,
        maxAttempts,
        errorMessage: message,
        finalAttempt,
      });

      throw error;
    }
  }
}
