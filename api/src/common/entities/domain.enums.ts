export enum PlatformCode {
  MERCADOLIBRE = 'mercadolibre',
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
}

export enum WorkspaceUserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATOR = 'operator',
  VIEWER = 'viewer',
}

export enum AccountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

export enum ConnectionStatus {
  PENDING = 'pending',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  EXPIRED = 'expired',
  ERROR = 'error',
}

export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum ListingStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  PAUSED = 'paused',
  ENDED = 'ended',
  ERROR = 'error',
}

export enum InventoryMovementType {
  SALE = 'sale',
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  ADJUSTMENT = 'adjustment',
  RETURN = 'return',
  RESERVATION = 'reservation',
  RELEASE = 'release',
  SYNC = 'sync',
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PACKED = 'packed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELED = 'canceled',
}

export enum OrderEventType {
  IMPORTED = 'imported',
  STATUS_CHANGED = 'status_changed',
  PAYMENT_UPDATED = 'payment_updated',
  FULFILLMENT_UPDATED = 'fulfillment_updated',
  COMMENT_ADDED = 'comment_added',
  WEBHOOK_RECEIVED = 'webhook_received',
  SYNC_TRIGGERED = 'sync_triggered',
}

export enum SyncJobType {
  SYNC_INVENTORY = 'sync_inventory',
  SYNC_PRICE = 'sync_price',
  PUBLISH_LISTING = 'publish_listing',
  IMPORT_ORDERS = 'import_orders',
  PROCESS_WEBHOOK = 'process_webhook',
}

export enum SyncJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export enum SyncLogLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

export enum WebhookStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
  IGNORED = 'ignored',
}
