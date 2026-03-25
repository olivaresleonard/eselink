import { Injectable } from '@nestjs/common';
import { SyncJobStatus, SyncJobType } from '../../common/entities/domain.enums.js';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import type { CreateSyncJobDto } from './dto/create-sync-job.dto.js';
import { QueueDispatcherService } from './queue-dispatcher.service.js';
import { SyncLoggingPolicy } from './sync-logging.policy.js';
import { SyncRetryPolicy } from './sync-retry.policy.js';
import { syncQueueNames } from './sync-jobs.constants.js';
import { SyncJobsRepository } from './sync-jobs.repository.js';

@Injectable()
export class SyncJobsService extends BaseDomainService {
  constructor(
    private readonly syncJobsRepository: SyncJobsRepository,
    private readonly queueDispatcherService: QueueDispatcherService,
    private readonly syncRetryPolicy: SyncRetryPolicy,
    private readonly syncLoggingPolicy: SyncLoggingPolicy,
  ) {
    super(syncJobsRepository);
  }

  async create(data: Record<string, unknown>) {
    const dto = data as unknown as CreateSyncJobDto;
    const type = dto.type as SyncJobType;
    const queueName = syncQueueNames[type];
    const maxAttempts = this.syncRetryPolicy.resolveAttempts(dto.attempts);

    const job = await this.syncJobsRepository.create({
      workspaceId: dto.workspaceId,
      accountId: dto.accountId,
      type,
      entityType: dto.entityType,
      entityId: dto.entityId,
      queueName,
      status: SyncJobStatus.PENDING,
      attempts: 0,
      maxAttempts,
      payload: dto.payload,
    });

    await this.queueDispatcherService.dispatch(job, dto.payload);

    await this.syncLoggingPolicy.logQueued({
      workspaceId: dto.workspaceId,
      accountId: dto.accountId ?? null,
      syncJobId: job.id,
      action: type,
      entityType: dto.entityType,
      entityId: dto.entityId,
      payload: dto.payload,
    });

    return job;
  }

  findTrackedJobOrFail(id: string) {
    return this.syncJobsRepository.findTrackedJobOrFail(id);
  }

  updateTrackedJob(id: string, data: Parameters<SyncJobsRepository['updateTrackedJob']>[1]) {
    return this.syncJobsRepository.updateTrackedJob(id, data);
  }
}
