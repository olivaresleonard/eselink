import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovementType, OrderEventType, OrderStatus } from '../../common/entities/domain.enums.js';
import { PlatformCode } from '../../common/entities/domain.enums.js';
import type { NormalizedOrder } from '../../integrations/channel-integration.interface.js';
import { MercadoLibreApiClient } from '../../integrations/mercadolibre/mercadolibre-api.client.js';
import { MercadoLibreAuthService } from '../../integrations/mercadolibre/mercadolibre-auth.service.js';
import { MercadoLibreOrdersService } from '../../integrations/mercadolibre/mercadolibre.orders.service.js';
import { Account } from '../accounts/account.entity.js';
import { InventoryItem } from '../inventory/inventory-item.entity.js';
import { InventoryMovement } from '../inventory-movements/inventory-movement.entity.js';
import { OrderEvent } from '../order-events/order-event.entity.js';
import { OrderItem } from '../order-items/order-item.entity.js';
import { SkuMapping } from '../sku-mappings/sku-mapping.entity.js';
import { Order } from './order.entity.js';

type MercadoLibreShipmentResponse = {
  status?: string;
  substatus?: string;
  logistic_type?: string;
  logistic?: {
    type?: string;
    mode?: string;
  };
  shipping_option?: {
    estimated_delivery_final?: {
      date?: string;
    };
    estimated_delivery_limit?: {
      date?: string;
    };
    estimated_delivery_time?: {
      date?: string;
    };
  };
  receiver_address?: {
    receiver_name?: string;
    address_line?: string;
    comment?: string;
    city?: { name?: string };
    state?: { name?: string };
    zip_code?: string;
    country?: { name?: string };
  };
  destination?: {
    receiver_name?: string;
    shipping_address?: {
      address_line?: string;
      comment?: string;
      city?: { name?: string };
      state?: { name?: string };
      zip_code?: string;
      country?: { name?: string };
      street_name?: string;
      street_number?: string;
      neighborhood?: { name?: string };
      municipality?: { name?: string };
    };
  };
};

type MercadoPagoPaymentDetailResponse = {
  transaction_amount?: number | string | null;
  total_paid_amount?: number | string | null;
  shipping_cost?: number | string | null;
  taxes_amount?: number | string | null;
  marketplace_fee?: number | string | null;
  net_received_amount?: number | string | null;
  transaction_details?: {
    net_received_amount?: number | string | null;
    total_paid_amount?: number | string | null;
  } | null;
  fee_details?: Array<{
    amount?: number | string | null;
    type?: string | null;
  }>;
  charges_details?: Array<{
    type?: string | null;
    name?: string | null;
    amounts?: {
      original?: number | string | null;
    } | null;
  }>;
};

@Injectable()
export class OrdersImportService {
  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(OrderEvent)
    private readonly orderEventsRepository: Repository<OrderEvent>,
    @InjectRepository(SkuMapping)
    private readonly skuMappingsRepository: Repository<SkuMapping>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemsRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryMovement)
    private readonly inventoryMovementsRepository: Repository<InventoryMovement>,
    private readonly mercadoLibreOrdersService: MercadoLibreOrdersService,
    private readonly mercadoLibreAuthService: MercadoLibreAuthService,
    private readonly mercadoLibreApiClient: MercadoLibreApiClient,
  ) {}

  async importOrders(accountId: string, options?: { limit?: number }) {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
      relations: { channel: true },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const sourceOrders =
      account.channel.code === PlatformCode.MERCADOLIBRE
        ? await this.mercadoLibreOrdersService.fetchPaidOrders(account.id, {
            limit: options?.limit ?? 50,
            since: account.lastOrdersSyncAt ?? null,
          })
        : this.buildFallbackOrders(account);

    const imported: Order[] = [];
    const skipped: string[] = [];

    for (const sourceOrder of sourceOrders) {
      const order = await this.upsertOrderFromSource(account, sourceOrder);

      if (order) {
        imported.push(order);
      } else {
        skipped.push(sourceOrder.externalOrderId);
      }
    }

    account.lastOrdersSyncAt = new Date();
    account.lastSyncAt = new Date();
    await this.accountsRepository.save(account);

    return {
      accountId: account.id,
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skippedExternalOrderIds: skipped,
    };
  }

  async importMercadoLibreOrder(accountId: string, externalOrderId: string) {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
      relations: { channel: true },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    if (account.channel.code !== PlatformCode.MERCADOLIBRE) {
      throw new NotFoundException(`Account ${accountId} is not a Mercado Libre account`);
    }

    const sourceOrder = await this.mercadoLibreOrdersService.fetchOrderById(account.id, externalOrderId);

    if (!sourceOrder) {
      return {
        imported: false,
        order: null,
      };
    }

    const order = await this.upsertOrderFromSource(account, sourceOrder);

    return {
      imported: Boolean(order),
      order,
    };
  }

  private buildFallbackOrders(account: Account): NormalizedOrder[] {
    return Array.from({ length: 3 }, (_, index): NormalizedOrder => {
      const placedAt = new Date(Date.now() - index * 60 * 60 * 1000);
      const externalOrderId = `${account.channel.code.toUpperCase()}-${account.id.slice(0, 8)}-${index + 1}`;
      return {
        externalOrderId,
        orderNumber: externalOrderId,
        customerName: `Cliente ${index + 1}`,
        customerEmail: undefined,
        status: index % 2 === 0 ? OrderStatus.PAID : OrderStatus.PENDING,
        currency: account.currency,
        totalAmount: 19990 + index * 5000,
        rawPayload: {
          date_created: placedAt.toISOString(),
        },
        items: [
          {
            externalItemId: undefined,
            externalSku: `SKU-${index + 1}-A`,
            title: `SKU-${index + 1}-A`,
            quantity: 1 + index,
            currency: account.currency,
            unitPrice: 9990 + index * 1000,
            totalAmount: (1 + index) * (9990 + index * 1000),
          },
          {
            externalItemId: undefined,
            externalSku: `SKU-${index + 1}-B`,
            title: `SKU-${index + 1}-B`,
            quantity: 1,
            currency: account.currency,
            unitPrice: 10000 + index * 2000,
            totalAmount: 10000 + index * 2000,
          },
        ],
      };
    });
  }

  private async refreshExistingMercadoLibreOrder(
    existing: Order,
    account: Account,
    sourceOrder: NormalizedOrder,
  ) {
    const shippingSnapshot = await this.fetchMercadoLibreShippingSnapshot(account, sourceOrder);

    existing.status = (sourceOrder.status as OrderStatus) ?? existing.status;
    existing.totalAmount = String(sourceOrder.totalAmount);
    existing.customerName = sourceOrder.customerName ?? existing.customerName ?? null;
    existing.customerEmail = sourceOrder.customerEmail ?? existing.customerEmail ?? null;
    existing.shippingAddress1 =
      sourceOrder.shippingAddress1 ?? shippingSnapshot?.shippingAddress1 ?? existing.shippingAddress1 ?? null;
    existing.shippingAddress2 =
      sourceOrder.shippingAddress2 ?? shippingSnapshot?.shippingAddress2 ?? existing.shippingAddress2 ?? null;
    existing.shippingCity =
      sourceOrder.shippingCity ?? shippingSnapshot?.shippingCity ?? existing.shippingCity ?? null;
    existing.shippingRegion =
      sourceOrder.shippingRegion ?? shippingSnapshot?.shippingRegion ?? existing.shippingRegion ?? null;
    existing.shippingPostalCode =
      sourceOrder.shippingPostalCode ??
      shippingSnapshot?.shippingPostalCode ??
      existing.shippingPostalCode ??
      null;
    existing.shippingCountry =
      sourceOrder.shippingCountry ?? shippingSnapshot?.shippingCountry ?? existing.shippingCountry ?? null;
    existing.shippingName =
      sourceOrder.shippingName ?? shippingSnapshot?.shippingName ?? existing.shippingName ?? null;
    const baseRawPayload =
      (sourceOrder.rawPayload as Record<string, unknown> | undefined) ??
      (sourceOrder as unknown as Record<string, unknown>);
    const financialSummary =
      account.channel.code === PlatformCode.MERCADOLIBRE
        ? await this.buildMercadoLibreFinancialSummary(
            account.id,
            baseRawPayload,
            Number(sourceOrder.totalAmount ?? existing.totalAmount ?? 0),
          )
        : null;
    existing.rawPayload = financialSummary
      ? {
          ...baseRawPayload,
          _eselink_financial_summary: financialSummary,
        }
      : baseRawPayload;
    existing.importedAt = new Date();
    existing.placedAt =
      sourceOrder.rawPayload && typeof sourceOrder.rawPayload.date_created === 'string'
        ? new Date(sourceOrder.rawPayload.date_created)
        : existing.placedAt;
    existing.shippingType = shippingSnapshot?.shippingType ?? existing.shippingType ?? null;
    existing.shippingStatus = shippingSnapshot?.shippingStatus ?? existing.shippingStatus ?? null;
    existing.shippingSubstatus =
      shippingSnapshot?.shippingSubstatus ?? existing.shippingSubstatus ?? null;
    existing.shippingStage = shippingSnapshot?.shippingStage ?? existing.shippingStage ?? null;
    existing.shippingExpectedDate =
      shippingSnapshot?.shippingExpectedDate ?? existing.shippingExpectedDate ?? null;
    existing.shippingSyncedAt = shippingSnapshot ? new Date() : existing.shippingSyncedAt ?? null;

    await this.ordersRepository.save(existing);
  }

  private async upsertOrderFromSource(account: Account, sourceOrder: NormalizedOrder) {
    const existing = await this.ordersRepository.findOne({
      where: {
        workspaceId: account.workspaceId,
        accountId: account.id,
        externalOrderId: sourceOrder.externalOrderId,
      },
    });

    if (existing) {
      if (account.channel.code === PlatformCode.MERCADOLIBRE) {
        await this.refreshExistingMercadoLibreOrder(existing, account, sourceOrder);
      }

      return null;
    }

    const shippingSnapshot =
      account.channel.code === PlatformCode.MERCADOLIBRE
        ? await this.fetchMercadoLibreShippingSnapshot(account, sourceOrder)
        : null;

    const rawPayload =
      (sourceOrder.rawPayload as Record<string, unknown> | undefined) ??
      (sourceOrder as unknown as Record<string, unknown>);
    const financialSummary =
      account.channel.code === PlatformCode.MERCADOLIBRE
        ? await this.buildMercadoLibreFinancialSummary(
            account.id,
            rawPayload,
            Number(sourceOrder.totalAmount ?? 0),
          )
        : null;

    const order = await this.ordersRepository.save(
      this.ordersRepository.create({
        workspaceId: account.workspaceId,
        accountId: account.id,
        channelId: account.channelId,
        externalOrderId: sourceOrder.externalOrderId,
        orderNumber: sourceOrder.orderNumber,
        status: (sourceOrder.status as OrderStatus) ?? OrderStatus.PENDING,
        currency: sourceOrder.currency ?? account.currency,
        customerName: sourceOrder.customerName,
        customerEmail: sourceOrder.customerEmail,
        shippingName: sourceOrder.shippingName ?? shippingSnapshot?.shippingName ?? null,
        shippingAddress1: sourceOrder.shippingAddress1 ?? shippingSnapshot?.shippingAddress1 ?? null,
        shippingAddress2: sourceOrder.shippingAddress2 ?? shippingSnapshot?.shippingAddress2 ?? null,
        shippingCity: sourceOrder.shippingCity ?? shippingSnapshot?.shippingCity ?? null,
        shippingRegion: sourceOrder.shippingRegion ?? shippingSnapshot?.shippingRegion ?? null,
        shippingPostalCode:
          sourceOrder.shippingPostalCode ?? shippingSnapshot?.shippingPostalCode ?? null,
        shippingCountry: sourceOrder.shippingCountry ?? shippingSnapshot?.shippingCountry ?? null,
        totalAmount: String(sourceOrder.totalAmount),
        shippingType: shippingSnapshot?.shippingType ?? null,
        shippingStatus: shippingSnapshot?.shippingStatus ?? null,
        shippingSubstatus: shippingSnapshot?.shippingSubstatus ?? null,
        shippingStage: shippingSnapshot?.shippingStage ?? null,
        shippingExpectedDate: shippingSnapshot?.shippingExpectedDate ?? null,
        shippingSyncedAt: shippingSnapshot ? new Date() : null,
        placedAt:
          sourceOrder.rawPayload && typeof sourceOrder.rawPayload.date_created === 'string'
            ? new Date(sourceOrder.rawPayload.date_created)
            : new Date(),
        importedAt: new Date(),
        rawPayload: financialSummary
          ? {
              ...rawPayload,
              _eselink_financial_summary: financialSummary,
            }
          : rawPayload,
      }),
    );

    const importErrors: string[] = [];

    for (const item of sourceOrder.items) {
      const mapping = await this.skuMappingsRepository.findOne({
        where: {
          workspaceId: account.workspaceId,
          accountId: account.id,
          externalSku: item.externalSku,
        },
      });

      const orderItem = this.orderItemsRepository.create({
        workspaceId: account.workspaceId,
        orderId: order.id,
        listingId: mapping?.listingId ?? null,
        externalSku: item.externalSku,
        title: item.title,
        quantity: item.quantity,
        currency: item.currency ?? account.currency,
        unitPrice: String(item.unitPrice),
        totalAmount: String(item.totalAmount ?? item.unitPrice * item.quantity),
        variantId: mapping?.variantId ?? null,
        externalItemId: item.externalItemId,
      });

      await this.orderItemsRepository.save(orderItem);

      if (!mapping) {
        importErrors.push(`External SKU ${item.externalSku} is not mapped`);
        continue;
      }

      const inventoryItem = await this.inventoryItemsRepository.findOne({
        where: {
          workspaceId: account.workspaceId,
          variantId: mapping.variantId,
        },
        order: { createdAt: 'ASC' },
      });

      if (!inventoryItem) {
        importErrors.push(`Inventory not found for external SKU ${item.externalSku}`);
        continue;
      }

      if (inventoryItem.available - item.quantity < 0) {
        importErrors.push(`Insufficient stock for external SKU ${item.externalSku}`);
        continue;
      }

      const previousAvailable = inventoryItem.available;
      inventoryItem.available -= item.quantity;
      inventoryItem.reserved += item.quantity;
      await this.inventoryItemsRepository.save(inventoryItem);

      await this.inventoryMovementsRepository.save(
        this.inventoryMovementsRepository.create({
          workspaceId: account.workspaceId,
          inventoryItemId: inventoryItem.id,
          type: InventoryMovementType.SALE,
          quantity: -item.quantity,
          previousAvailable,
          newAvailable: inventoryItem.available,
          referenceType: 'order',
          referenceId: order.id,
          reason: 'Inventory discounted from imported order',
        }),
      );
    }

    await this.orderEventsRepository.save(
      this.orderEventsRepository.create({
        workspaceId: account.workspaceId,
        orderId: order.id,
        type: OrderEventType.IMPORTED,
        notes:
          importErrors.length > 0
            ? 'Order imported with SKU mapping or inventory warnings'
            : account.channel.code === PlatformCode.MERCADOLIBRE
              ? 'Order imported from Mercado Libre'
              : 'Order imported from fallback source',
        payload: {
          ...((sourceOrder.rawPayload as Record<string, unknown> | undefined) ??
            (sourceOrder as unknown as Record<string, unknown>)),
          importErrors,
        },
      }),
    );

    return order;
  }

  private async fetchMercadoLibreShippingSnapshot(account: Account, sourceOrder: NormalizedOrder) {
    const shipmentId = this.extractShipmentId(
      (sourceOrder.rawPayload as Record<string, unknown> | undefined) ??
        (sourceOrder as unknown as Record<string, unknown>),
    );

    if (!shipmentId) {
      return null;
    }

    const accessToken = await this.mercadoLibreAuthService.ensureAccessToken(account.id);

    if (!accessToken) {
      return null;
    }

    try {
      const shipment = await this.mercadoLibreApiClient.request<MercadoLibreShipmentResponse>(
        `/shipments/${shipmentId}`,
        {
          method: 'GET',
          accessToken,
          headers: {
            'x-format-new': 'true',
          },
        },
      );

      const shippingType = this.mapShippingType(shipment);
      const shippingStatus = shipment.status ?? null;
      const shippingSubstatus = shipment.substatus ?? null;
      const shippingStage = this.mapShippingStage(shipment);
      const expectedDate =
        shipment.shipping_option?.estimated_delivery_final?.date ??
        shipment.shipping_option?.estimated_delivery_limit?.date ??
        shipment.shipping_option?.estimated_delivery_time?.date ??
        null;
      const destinationAddress = shipment.destination?.shipping_address;
      const receiverAddress = shipment.receiver_address;
      const resolvedAddressLine =
        destinationAddress?.address_line ??
        (
          [destinationAddress?.street_name, destinationAddress?.street_number]
            .filter(Boolean)
            .join(' ')
            .trim() || null
        ) ??
        receiverAddress?.address_line ??
        null;
      const resolvedAddressComment =
        destinationAddress?.comment ??
        destinationAddress?.neighborhood?.name ??
        receiverAddress?.comment ??
        null;
      const resolvedCity =
        destinationAddress?.city?.name ??
        destinationAddress?.municipality?.name ??
        receiverAddress?.city?.name ??
        null;
      const resolvedRegion =
        destinationAddress?.state?.name ?? receiverAddress?.state?.name ?? null;
      const resolvedPostalCode =
        destinationAddress?.zip_code ?? receiverAddress?.zip_code ?? null;
      const resolvedCountry =
        destinationAddress?.country?.name ?? receiverAddress?.country?.name ?? null;

      return {
        shippingType,
        shippingStatus,
        shippingSubstatus,
        shippingStage,
        shippingExpectedDate: expectedDate ? new Date(expectedDate) : null,
        shippingName: shipment.destination?.receiver_name ?? shipment.receiver_address?.receiver_name ?? null,
        shippingAddress1: resolvedAddressLine,
        shippingAddress2: resolvedAddressComment,
        shippingCity: resolvedCity,
        shippingRegion: resolvedRegion,
        shippingPostalCode: resolvedPostalCode,
        shippingCountry: resolvedCountry,
      };
    } catch {
      return null;
    }
  }

  private extractShipmentId(rawPayload?: Record<string, unknown> | null) {
    const shipping = rawPayload?.shipping;
    if (typeof shipping !== 'object' || shipping === null) {
      return null;
    }

    const shipmentId = (shipping as { id?: string | number }).id;
    if (typeof shipmentId === 'string' || typeof shipmentId === 'number') {
      return String(shipmentId);
    }

    return null;
  }

  private mapShippingType(
    shipment?: MercadoLibreShipmentResponse | null,
  ): 'flex' | 'mercado_envios' | null {
    const logisticType = shipment?.logistic?.type ?? shipment?.logistic_type;
    const logisticMode = shipment?.logistic?.mode;

    if (logisticType === 'self_service') {
      return 'flex';
    }

    if (logisticMode === 'me2') {
      return 'mercado_envios';
    }

    return null;
  }

  private mapShippingStage(
    shipment?: MercadoLibreShipmentResponse | null,
  ):
    | 'ready_to_print'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'rescheduled'
    | null {
    const shippingStatus = shipment?.status?.toLowerCase() ?? null;
    const shippingSubstatus = shipment?.substatus?.toLowerCase() ?? null;

    if (shippingStatus === 'cancelled') {
      return 'cancelled';
    }

    if (shippingStatus === 'delivered') {
      return 'delivered';
    }

    if (
      shippingSubstatus === 'rescheduled' ||
      shippingSubstatus === 'reprogrammed' ||
      shippingSubstatus === 'reprogramado'
    ) {
      return 'rescheduled';
    }

    if (shippingStatus === 'shipped') {
      return 'shipped';
    }

    if (
      shippingStatus === 'ready_to_ship' &&
      ['in_hub', 'in_packing_list', 'picked_up', 'dropped_off'].includes(
        shippingSubstatus ?? '',
      )
    ) {
      return 'shipped';
    }

    if (shippingSubstatus === 'ready_to_print') {
      return 'ready_to_print';
    }

    if (shippingStatus === 'ready_to_ship') {
      return 'ready_to_ship';
    }

    return null;
  }

  private async buildMercadoLibreFinancialSummary(
    accountId: string,
    rawPayload: Record<string, unknown>,
    orderTotalAmount: number,
  ) {
    const rawPayments = rawPayload?.payments;
    if (!Array.isArray(rawPayments) || rawPayments.length === 0) {
      return null;
    }

    const payments = rawPayments.filter(
      (payment): payment is Record<string, unknown> =>
        typeof payment === 'object' && payment !== null,
    );

    if (payments.length === 0) {
      return null;
    }

    const paymentIds = payments
      .map((payment) => payment.id)
      .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number');

    const remotePaymentDetails = await this.fetchMercadoPagoPaymentDetails(accountId, paymentIds);
    const totalPaidAmount =
      this.sumMercadoPagoPaymentField(remotePaymentDetails, 'total_paid_amount') ||
      this.sumMercadoPagoPaymentField(remotePaymentDetails, 'transaction_amount') ||
      this.sumPaymentField(payments, 'total_paid_amount') ||
      this.sumPaymentField(payments, 'transaction_amount');
    const marketplaceFee =
      this.sumMercadoPagoFeeCharges(remotePaymentDetails) ||
      this.sumMercadoPagoPaymentField(remotePaymentDetails, 'marketplace_fee') ||
      this.sumPaymentField(payments, 'marketplace_fee');
    const taxesAmount =
      this.sumMercadoPagoPaymentField(remotePaymentDetails, 'taxes_amount') ||
      this.sumPaymentField(payments, 'taxes_amount');
    const shippingCost =
      this.sumMercadoPagoShippingCharges(remotePaymentDetails) ||
      this.sumMercadoPagoPaymentField(remotePaymentDetails, 'shipping_cost') ||
      this.sumPaymentField(payments, 'shipping_cost');
    const couponAmount = this.sumPaymentField(payments, 'coupon_amount');
    const transactionAmount =
      this.sumMercadoPagoPaymentField(remotePaymentDetails, 'transaction_amount') ||
      this.sumPaymentField(payments, 'transaction_amount');
    const installments = payments.reduce((max, payment) => {
      const value = Number(payment.installments ?? 0);
      return Number.isFinite(value) && value > max ? value : max;
    }, 0);
    const authorizationCode = payments.find(
      (payment) =>
        typeof payment.authorization_code === 'string' &&
        payment.authorization_code.trim().length > 0,
    )?.authorization_code as string | undefined;
    const customerShippingAmount = Number(rawPayload.shipping_amount ?? 0);
    const saleBase = transactionAmount > 0 ? transactionAmount : Number(orderTotalAmount ?? 0);
    const baseNet = saleBase - (marketplaceFee + taxesAmount + shippingCost);
    const netReceivedAmount = this.sumMercadoPagoNetReceivedAmount(remotePaymentDetails);
    const bonusAmount = netReceivedAmount > baseNet ? netReceivedAmount - baseNet : 0;
    const estimatedNetBeforeCost = netReceivedAmount > 0 ? netReceivedAmount : baseNet;

    return {
      saleBase,
      customerShippingAmount,
      totalPaidAmount,
      marketplaceFee,
      taxesAmount,
      shippingCost,
      bonusAmount,
      couponAmount,
      installments: installments > 0 ? installments : null,
      authorizationCode: authorizationCode?.trim() || null,
      estimatedNetBeforeCost,
    };
  }

  private async fetchMercadoPagoPaymentDetails(
    accountId: string,
    paymentIds: Array<string | number>,
  ): Promise<MercadoPagoPaymentDetailResponse[]> {
    if (paymentIds.length === 0) {
      return [];
    }

    try {
      const accessToken = await this.mercadoLibreAuthService.ensureAccessToken(accountId);

      const details = await Promise.all(
        paymentIds.map((paymentId) =>
          this.mercadoLibreApiClient.request<MercadoPagoPaymentDetailResponse>(
            `/v1/payments/${paymentId}`,
            {
              method: 'GET',
              accessToken,
              baseUrl: 'https://api.mercadopago.com',
            },
          ),
        ),
      );

      return details.filter(Boolean);
    } catch {
      return [];
    }
  }

  private sumPaymentField(payments: Array<Record<string, unknown>>, field: string) {
    return payments.reduce((sum, payment) => {
      const value = Number(payment[field] ?? 0);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  private sumMercadoPagoPaymentField(
    payments: MercadoPagoPaymentDetailResponse[],
    field: 'total_paid_amount' | 'transaction_amount' | 'shipping_cost' | 'taxes_amount' | 'marketplace_fee',
  ) {
    return payments.reduce((sum, payment) => {
      const value = Number(payment[field] ?? 0);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  private sumMercadoPagoNetReceivedAmount(payments: MercadoPagoPaymentDetailResponse[]) {
    return payments.reduce((sum, payment) => {
      const value = Number(
        payment.transaction_details?.net_received_amount ?? payment.net_received_amount ?? 0,
      );
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  private sumMercadoPagoFeeCharges(payments: MercadoPagoPaymentDetailResponse[]) {
    return payments.reduce((sum, payment) => {
      const byCharges =
        payment.charges_details?.reduce((chargesSum, charge) => {
          const isFee =
            charge.type === 'fee' ||
            charge.name === 'meli_fee' ||
            charge.name === 'application_fee';
          const amount = Number(charge.amounts?.original ?? 0);
          return isFee && Number.isFinite(amount) ? chargesSum + amount : chargesSum;
        }, 0) ?? 0;

      const byFeeDetails =
        payment.fee_details?.reduce((feeSum, fee) => {
          const isFee = fee.type === 'application_fee' || fee.type === 'fee';
          const amount = Number(fee.amount ?? 0);
          return isFee && Number.isFinite(amount) ? feeSum + amount : feeSum;
        }, 0) ?? 0;

      return sum + Math.max(byCharges, byFeeDetails);
    }, 0);
  }

  private sumMercadoPagoShippingCharges(payments: MercadoPagoPaymentDetailResponse[]) {
    return payments.reduce((sum, payment) => {
      const shippingAmount =
        payment.charges_details?.reduce((chargesSum, charge) => {
          const isShipping = charge.type === 'shipping';
          const amount = Number(charge.amounts?.original ?? 0);
          return isShipping && Number.isFinite(amount) ? chargesSum + amount : chargesSum;
        }, 0) ?? 0;

      return sum + shippingAmount;
    }, 0);
  }
}
