import { Injectable } from '@nestjs/common';
import { SyncLogLevel } from '../../common/entities/domain.enums.js';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { SyncLogsRepository } from './sync-logs.repository.js';

@Injectable()
export class SyncLogsService extends BaseDomainService {
  constructor(private readonly syncLogsRepository: SyncLogsRepository) {
    super(syncLogsRepository);
  }

  create(data: {
    workspaceId: string;
    accountId?: string;
    listingId?: string;
    syncJobId?: string;
    action: string;
    status: string;
    message: string;
    level?: 'info' | 'warning' | 'error';
    payloadSummary?: Record<string, unknown>;
    context?: Record<string, unknown>;
  }) {
    return this.syncLogsRepository.create({
      ...data,
      level:
        data.level === 'warning'
          ? SyncLogLevel.WARNING
          : data.level === 'error'
            ? SyncLogLevel.ERROR
            : SyncLogLevel.INFO,
    });
  }
}
