import { SyncJobType } from '../../common/entities/domain.enums.js';

export type BaseSyncJobPayload = {
  syncJobId: string;
  workspaceId: string;
  accountId?: string;
  type: SyncJobType;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  attempts: number;
};

export type InventorySyncPayload = BaseSyncJobPayload & {
  type: SyncJobType.SYNC_INVENTORY;
};

export type PriceSyncPayload = BaseSyncJobPayload & {
  type: SyncJobType.SYNC_PRICE;
};

export type ListingSyncPayload = BaseSyncJobPayload & {
  type: SyncJobType.PUBLISH_LISTING;
};

export type OrdersImportPayload = BaseSyncJobPayload & {
  type: SyncJobType.IMPORT_ORDERS;
};

export type WebhookProcessingPayload = BaseSyncJobPayload & {
  type: SyncJobType.PROCESS_WEBHOOK;
};
