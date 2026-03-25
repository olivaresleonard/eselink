export type PlatformCode = 'mercadolibre' | 'shopify' | 'woocommerce';

export interface WorkspaceScoped {
  id: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectedAccount extends WorkspaceScoped {
  channelId: string;
  name: string;
  externalId: string;
  platform: PlatformCode;
  status: 'active' | 'inactive' | 'error';
}

export interface OrderRow extends WorkspaceScoped {
  accountId: string;
  channelId: string;
  platform?: PlatformCode;
  channelName?: string | null;
  channelCountryCode?: string | null;
  packId?: string | null;
  orderNumber: string;
  externalOrderId: string;
  placedAt?: string | null;
  status: string;
  shippingStatus?: string | null;
  shippingSubstatus?: string | null;
  shippingSlaStatus?: string | null;
  shippingExpectedDate?: string | null;
  shippingDeliveredAt?: string | null;
  shippingType?: 'flex' | 'mercado_envios' | null;
  shipmentId?: string | null;
  shippingAddress1?: string | null;
  shippingAddress2?: string | null;
  shippingCity?: string | null;
  shippingRegion?: string | null;
  shippingPostalCode?: string | null;
  shippingCountry?: string | null;
  shippingStage?:
    | 'ready_to_print'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'rescheduled'
    | null;
  shippingOverdue?: boolean;
  customerName?: string | null;
  customerDisplayName?: string | null;
  customerNickname?: string | null;
  totalAmount: number;
  totalUnits?: number | null;
  currency: string;
}
