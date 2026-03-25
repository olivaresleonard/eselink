type SyncJobType =
  | 'sync_inventory'
  | 'sync_price'
  | 'publish_listing'
  | 'import_orders'
  | 'process_webhook';

export const syncQueueNames = {
  sync_inventory: 'inventory-sync-queue',
  sync_price: 'price-sync-queue',
  publish_listing: 'listing-sync-queue',
  import_orders: 'orders-import-queue',
  process_webhook: 'webhook-processing-queue',
} as const satisfies Record<SyncJobType, string>;

export type SyncQueueName = (typeof syncQueueNames)[keyof typeof syncQueueNames];
