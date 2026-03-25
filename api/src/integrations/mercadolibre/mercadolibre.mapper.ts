import { Injectable } from '@nestjs/common';
import { ListingStatus, OrderStatus, ProductStatus } from '../../common/entities/domain.enums.js';
import type { NormalizedOrder } from '../channel-integration.interface.js';

type MercadoLibreItem = {
  id: string;
  title: string;
  status?: string;
  price?: number;
  currency_id?: string;
  available_quantity?: number;
  permalink?: string;
  category_id?: string;
  seller_custom_field?: string | null;
  attributes?: Array<{ id?: string; value_name?: string; value_id?: string }>;
  variations?: Array<{ id?: number | string; seller_custom_field?: string | null }>;
};

type MercadoLibreOrder = {
  id: number | string;
  status?: string;
  total_amount?: number;
  currency_id?: string;
  date_created?: string;
  buyer?: {
    first_name?: string;
    last_name?: string;
    nickname?: string;
    email?: string;
  };
  shipping?: {
    receiver_address?: {
      receiver_name?: string;
      address_line?: string;
      comment?: string;
      city?: { name?: string };
      state?: { name?: string };
      zip_code?: string;
      country?: { name?: string };
    };
  };
  order_items?: Array<{
    item?: {
      id?: string;
      title?: string;
      seller_sku?: string;
    };
    quantity?: number;
    unit_price?: number;
  }>;
};

@Injectable()
export class MercadoLibreMapper {
  mapItem(input: { workspaceId: string; accountId: string; channelId: string; item: MercadoLibreItem }) {
    const sku = this.resolveSku(input.item);

    return {
      product: {
        workspaceId: input.workspaceId,
        title: input.item.title,
        handle: input.item.id,
        status:
          input.item.status === 'active' ? ProductStatus.ACTIVE : ProductStatus.DRAFT,
        attributes: {
          categoryId: input.item.category_id,
          importedFrom: 'mercadolibre',
        },
      },
      variant: {
        workspaceId: input.workspaceId,
        sku,
        title: input.item.title,
        price: String(input.item.price ?? 0),
        currency: input.item.currency_id ?? 'CLP',
        attributes: {
          importedFrom: 'mercadolibre',
        },
      },
      listing: {
        workspaceId: input.workspaceId,
        accountId: input.accountId,
        channelId: input.channelId,
        externalListingId: input.item.id,
        externalSku: sku,
        title: input.item.title,
        status:
          input.item.status === 'active'
            ? ListingStatus.PUBLISHED
            : ListingStatus.DRAFT,
        permalink: input.item.permalink,
        currency: input.item.currency_id ?? 'CLP',
        price: String(input.item.price ?? 0),
        stock: input.item.available_quantity ?? 0,
        metadata: input.item,
      },
    };
  }

  mapOrder(order: MercadoLibreOrder): NormalizedOrder {
    const receiverAddress = order.shipping?.receiver_address;

    return {
      externalOrderId: String(order.id),
      orderNumber: `ML-${order.id}`,
      status: order.status ?? OrderStatus.PENDING,
      currency: order.currency_id ?? 'CLP',
      customerName: order.buyer?.nickname,
      customerEmail: order.buyer?.email,
      shippingName: receiverAddress?.receiver_name,
      shippingAddress1: receiverAddress?.address_line,
      shippingAddress2: receiverAddress?.comment,
      shippingCity: receiverAddress?.city?.name,
      shippingRegion: receiverAddress?.state?.name,
      shippingPostalCode: receiverAddress?.zip_code,
      shippingCountry: receiverAddress?.country?.name,
      totalAmount: order.total_amount ?? 0,
      items:
        order.order_items?.map((item) => ({
          externalItemId: item.item?.id,
          externalSku: item.item?.seller_sku,
          title: item.item?.title ?? 'Mercado Libre item',
          quantity: item.quantity ?? 1,
          currency: order.currency_id ?? 'CLP',
          unitPrice: item.unit_price ?? 0,
          totalAmount: (item.quantity ?? 1) * (item.unit_price ?? 0),
        })) ?? [],
      rawPayload: order as Record<string, unknown>,
    };
  }

  private resolveSku(item: MercadoLibreItem) {
    return (
      item.seller_custom_field ??
      item.variations?.find((variation) => variation.seller_custom_field)?.seller_custom_field ??
      item.attributes?.find((attribute) => attribute.id === 'SELLER_SKU')?.value_name ??
      `ML-${item.id}`
    );
  }
}
