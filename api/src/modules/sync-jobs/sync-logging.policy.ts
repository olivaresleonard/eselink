import { Injectable } from '@nestjs/common';
import { SyncLogsService } from '../sync-logs/sync-logs.service.js';

@Injectable()
export class SyncLoggingPolicy {
  constructor(private readonly syncLogsService: SyncLogsService) {}

  logQueued(data: {
    workspaceId: string;
    accountId?: string | null;
    syncJobId: string;
    action: string;
    entityType: string;
    entityId: string;
    payload?: Record<string, unknown> | null;
  }) {
    return this.syncLogsService.create({
      workspaceId: data.workspaceId,
      accountId: data.accountId ?? undefined,
      syncJobId: data.syncJobId,
      action: data.action,
      status: 'queued',
      message: `Job ${data.action} enqueued`,
      payloadSummary: {
        entityType: data.entityType,
        entityId: data.entityId,
      },
      context: data.payload ?? undefined,
    });
  }

  logProcessing(data: {
    workspaceId: string;
    accountId?: string | null;
    syncJobId: string;
    action: string;
    entityType: string;
    entityId: string;
    attempt: number;
  }) {
    return this.syncLogsService.create({
      workspaceId: data.workspaceId,
      accountId: data.accountId ?? undefined,
      syncJobId: data.syncJobId,
      action: data.action,
      status: 'processing',
      message: `Processing ${data.action}`,
      payloadSummary: {
        entityType: data.entityType,
        entityId: data.entityId,
        attempt: data.attempt,
      },
    });
  }

  logCompleted(data: {
    workspaceId: string;
    accountId?: string | null;
    syncJobId: string;
    action: string;
  }) {
    return this.syncLogsService.create({
      workspaceId: data.workspaceId,
      accountId: data.accountId ?? undefined,
      syncJobId: data.syncJobId,
      action: data.action,
      status: 'completed',
      message: `${data.action} completed successfully`,
    });
  }

  logFailure(data: {
    workspaceId: string;
    accountId?: string | null;
    syncJobId: string;
    action: string;
    attempt: number;
    maxAttempts: number;
    errorMessage: string;
    finalAttempt: boolean;
  }) {
    return this.syncLogsService.create({
      workspaceId: data.workspaceId,
      accountId: data.accountId ?? undefined,
      syncJobId: data.syncJobId,
      action: data.action,
      status: data.finalAttempt ? 'failed' : 'retrying',
      level: data.finalAttempt ? 'error' : 'warning',
      message: data.errorMessage,
      payloadSummary: {
        attempt: data.attempt,
        maxAttempts: data.maxAttempts,
      },
    });
  }

  logDomainEvent(data: {
    syncJobId?: string;
    workspaceId: string;
    accountId?: string | null;
    listingId?: string | null;
    action: string;
    status: string;
    message: string;
    payloadSummary?: Record<string, unknown>;
    context?: Record<string, unknown>;
    level?: 'info' | 'warning' | 'error';
  }) {
    return this.syncLogsService.create({
      workspaceId: data.workspaceId,
      accountId: data.accountId ?? undefined,
      listingId: data.listingId ?? undefined,
      syncJobId: data.syncJobId,
      action: data.action,
      status: data.status,
      message: data.message,
      payloadSummary: data.payloadSummary,
      context: data.context,
      level: data.level,
    });
  }
}
