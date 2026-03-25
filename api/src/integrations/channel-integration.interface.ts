import { PlatformCode } from '../common/entities/domain.enums.js';

export type NormalizedOrderItem = {
  externalItemId?: string;
  externalSku?: string;
  title: string;
  quantity: number;
  currency?: string;
  unitPrice: number;
  totalAmount?: number;
};

export type NormalizedOrder = {
  externalOrderId: string;
  orderNumber: string;
  status?: string;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  shippingName?: string;
  shippingAddress1?: string;
  shippingAddress2?: string;
  shippingCity?: string;
  shippingRegion?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  totalAmount: number;
  items: NormalizedOrderItem[];
  rawPayload?: Record<string, unknown>;
};

export interface ChannelIntegrationService {
  readonly platform: PlatformCode;

  updateStock(input: {
    accountExternalId: string;
    externalListingId?: string | null;
    externalSku?: string | null;
    availableStock: number;
    payload?: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;

  updatePrice(input: {
    accountExternalId: string;
    externalListingId?: string | null;
    externalSku?: string | null;
    price: number;
    currency?: string;
    payload?: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;

  publishListing(input: {
    accountExternalId: string;
    listingId: string;
    title: string;
    externalSku?: string | null;
    price?: number | null;
    availableStock?: number | null;
    payload?: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;

  fetchOrders(input: {
    accountExternalId: string;
    payload?: Record<string, unknown>;
  }): Promise<NormalizedOrder[]>;
}
