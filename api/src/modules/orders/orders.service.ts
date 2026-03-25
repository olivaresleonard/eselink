import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PDFDocument } from 'pdf-lib';
import { Brackets, Repository } from 'typeorm';
import { AccountStatus, PlatformCode } from '../../common/entities/domain.enums.js';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OperationContextService } from '../../core/operation-context/operation-context.service.js';
import { MercadoLibreApiClient } from '../../integrations/mercadolibre/mercadolibre-api.client.js';
import { MercadoLibreAuthService } from '../../integrations/mercadolibre/mercadolibre-auth.service.js';
import { Account } from '../accounts/account.entity.js';
import { OrderAssignment } from '../order-assignments/order-assignment.entity.js';
import { OrderComment } from '../order-comments/order-comment.entity.js';
import { OrderEvent } from '../order-events/order-event.entity.js';
import { OrderItem } from '../order-items/order-item.entity.js';
import { OrderTag } from '../order-tags/order-tag.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { User } from '../users/user.entity.js';
import { AssignOrderDto } from './dto/assign-order.dto.js';
import { CreateOrderCommentDto } from './dto/create-order-comment.dto.js';
import { GetOrdersQueryDto } from './dto/get-orders-query.dto.js';
import { Order } from './order.entity.js';
import { OrdersImportService } from './orders-import.service.js';
import { OrdersRepository } from './orders.repository.js';

type ShipmentSlaResponse = {
  expected_date?: string;
  status?: string;
};

type MercadoLibreItemImageResponse = {
  thumbnail?: string;
  pictures?: Array<{ url?: string }>;
};

type MercadoLibreShipmentResponse = {
  status?: string;
  substatus?: string;
  last_updated?: string;
  status_history?: {
    date_delivered?: string;
    date_cancelled?: string;
  };
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
};

type ShippingSummary = {
  shippingType: 'flex' | 'mercado_envios' | null;
  shippingStatus: string | null;
  shippingSubstatus: string | null;
  shippingSlaStatus: string | null;
  lastUpdated: string | null;
  shippingStage:
    | 'ready_to_print'
    | 'ready_to_ship'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'rescheduled'
    | null;
  estimatedDeliveryDate: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
};

type MercadoPagoPaymentDetailResponse = {
  id?: number | string;
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
      refunded?: number | string | null;
    } | null;
  }>;
};

type StoredMercadoLibreFinancialSummary = {
  saleBase: number;
  customerShippingAmount: number;
  totalPaidAmount: number;
  marketplaceFee: number;
  taxesAmount: number;
  shippingCost: number;
  bonusAmount: number;
  couponAmount: number;
  installments?: number | null;
  authorizationCode?: string | null;
  estimatedNetBeforeCost: number;
};

@Injectable()
export class OrdersService extends BaseDomainService {
  constructor(
    repository: OrdersRepository,
    @InjectRepository(Order)
    private readonly ordersOrmRepository: Repository<Order>,
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
    @InjectRepository(OrderEvent)
    private readonly orderEventsRepository: Repository<OrderEvent>,
    @InjectRepository(OrderComment)
    private readonly orderCommentsRepository: Repository<OrderComment>,
    @InjectRepository(OrderAssignment)
    private readonly orderAssignmentsRepository: Repository<OrderAssignment>,
    @InjectRepository(OrderTag)
    private readonly orderTagsRepository: Repository<OrderTag>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly operationContextService: OperationContextService,
    private readonly mercadoLibreAuthService: MercadoLibreAuthService,
    private readonly mercadoLibreApiClient: MercadoLibreApiClient,
    private readonly ordersImportService: OrdersImportService,
  ) {
    super(repository);
  }

  async findUnified(query: GetOrdersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.ordersOrmRepository
      .createQueryBuilder('orders')
      .leftJoinAndSelect('orders.account', 'account')
      .leftJoinAndSelect('orders.channel', 'channel')
      .leftJoinAndSelect('orders.items', 'items')
      .leftJoinAndSelect('items.listing', 'listing')
      .leftJoinAndSelect('items.variant', 'variant')
      .orderBy('orders.placedAt', 'DESC')
      .addOrderBy('orders.createdAt', 'DESC');

    if (query.accountId) {
      qb.andWhere('orders.account_id = :accountId', { accountId: query.accountId });
    }

    if (query.platform) {
      qb.andWhere('channel.code = :platform', { platform: query.platform });
    }

    if (query.status) {
      qb.andWhere('orders.status = :status', { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere('orders.placed_at >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('orders.placed_at <= :dateTo', { dateTo: query.dateTo });
    }

    if (query.search) {
      qb.andWhere(
        new Brackets((subQb) => {
          subQb
            .where('orders.order_number ILIKE :search', { search: `%${query.search}%` })
            .orWhere('orders.external_order_id ILIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('orders.customer_name ILIKE :search', {
              search: `%${query.search}%`,
            })
            .orWhere('account.name ILIKE :search', { search: `%${query.search}%` });
        }),
      );
    }

    if (query.onlyPending) {
      qb.andWhere('orders.status = :pendingStatus', { pendingStatus: 'pending' });
    }

    if (query.onlyRecent48Hours) {
      const recentSince = new Date(Date.now() - 48 * 60 * 60 * 1000);
      qb.andWhere(
        'COALESCE(orders.placed_at, orders.imported_at, orders.created_at) >= :recentSince',
        { recentSince: recentSince.toISOString() },
      );
    }

    const baseItems = await qb.getMany();
    const filteredItems = query.onlyShippingToday
      ? await this.filterOrdersWithShippingToday(baseItems, query.shippingDate)
      : baseItems;
    const purchaseGroupSizes = this.buildPurchaseGroupSizes(filteredItems);
    const total = filteredItems.length;
    const pendingCount = filteredItems.filter((order) => order.status === 'pending').length;
    const items = filteredItems.slice((page - 1) * limit, page * limit);
    const productSummaries = await this.buildProductSummaries(items, {
      refreshShippingSnapshot: query.onlyShippingToday,
    });

    return {
      data: items.map((order) => ({
        ...this.extractCustomerSummary(order),
        ...(productSummaries.get(order.id) ?? {
          productTitle: null,
          productImageUrl: null,
          shippingType: null,
          shippingStatus: null,
          shippingSubstatus: null,
          shippingSlaStatus: null,
          shippingExpectedDate: null,
          shippingDeliveredAt: null,
          shippingStage: null,
        }),
        ...this.extractPurchaseSummary(order, purchaseGroupSizes),
        id: order.id,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        accountId: order.accountId,
        channelId: order.channelId,
        platform: order.channel?.code ?? undefined,
        channelName: order.channel?.name ?? null,
        channelCountryCode: order.channel?.countryCode ?? null,
        orderNumber: order.orderNumber,
        externalOrderId: order.externalOrderId,
        account: order.account.name,
        status: order.status,
        shipmentId: this.extractShipmentId(order.rawPayload),
        shippingAddress1: order.shippingAddress1 ?? null,
        shippingAddress2: order.shippingAddress2 ?? null,
        shippingCity: order.shippingCity ?? null,
        shippingRegion: order.shippingRegion ?? null,
        shippingPostalCode: order.shippingPostalCode ?? null,
        shippingCountry: order.shippingCountry ?? null,
        totalAmount: Number(order.totalAmount),
        totalUnits: this.extractTotalUnits(order),
        profitAmount: this.calculateProfitAmount(order),
        currency: order.currency,
        placedAt: order.placedAt,
        importedAt: order.importedAt,
        isNew: order.status === 'pending',
      })),
      meta: {
        total,
        pendingCount,
        purchaseCount: purchaseGroupSizes.size,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async refreshOpenSnapshots(accountId?: string) {
    const recentSince = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const qb = this.ordersOrmRepository
      .createQueryBuilder('orders')
      .leftJoinAndSelect('orders.items', 'items')
      .leftJoinAndSelect('items.listing', 'listing')
      .leftJoinAndSelect('items.variant', 'variant')
      .where('COALESCE(orders.placed_at, orders.imported_at, orders.created_at) >= :recentSince', {
        recentSince: recentSince.toISOString(),
      })
      .andWhere(
        new Brackets((subQb) => {
          subQb
            .where('orders.shipping_stage IN (:...stages)', {
              stages: ['ready_to_print', 'ready_to_ship', 'shipped'],
            })
            .orWhere('orders.shipping_status IN (:...statuses)', {
              statuses: ['ready_to_ship', 'shipped'],
            });
        }),
      )
      .andWhere('orders.status != :cancelledStatus', { cancelledStatus: 'canceled' })
      .orderBy('orders.created_at', 'ASC');

    if (accountId) {
      qb.andWhere('orders.account_id = :accountId', { accountId });
    }

    const orders = (await qb.getMany())
      .sort((left, right) => {
        const leftPriority = left.shippingSyncedAt ? 1 : 0;
        const rightPriority = right.shippingSyncedAt ? 1 : 0;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        const leftSyncedAt = left.shippingSyncedAt?.getTime() ?? 0;
        const rightSyncedAt = right.shippingSyncedAt?.getTime() ?? 0;
        if (leftSyncedAt !== rightSyncedAt) {
          return leftSyncedAt - rightSyncedAt;
        }

        const leftUpdatedAt = left.updatedAt.getTime();
        const rightUpdatedAt = right.updatedAt.getTime();
        if (leftUpdatedAt !== rightUpdatedAt) {
          return leftUpdatedAt - rightUpdatedAt;
        }

        const leftCreatedAt = left.createdAt.getTime();
        const rightCreatedAt = right.createdAt.getTime();
        if (leftCreatedAt !== rightCreatedAt) {
          return leftCreatedAt - rightCreatedAt;
        }

        const leftPlacedAt = left.placedAt?.getTime() ?? 0;
        const rightPlacedAt = right.placedAt?.getTime() ?? 0;
        return rightPlacedAt - leftPlacedAt;
      })
      .slice(0, 120);

    if (orders.length === 0) {
      return { refreshed: 0 };
    }

    await this.buildProductSummaries(orders, {
      refreshShippingSnapshot: true,
    });

    return { refreshed: orders.length };
  }

  async refreshLiveOrders(accountId?: string) {
    const workspaceId = await this.operationContextService.getDefaultWorkspaceId();
    const accounts = accountId
      ? await this.accountsRepository.find({
          where: {
            id: accountId,
            workspaceId,
            status: AccountStatus.ACTIVE,
          },
          relations: { channel: true },
        })
      : await this.accountsRepository.find({
          where: {
            workspaceId,
            status: AccountStatus.ACTIVE,
          },
          relations: { channel: true },
          order: { createdAt: 'ASC' },
        });

    const mercadoLibreAccounts = accounts.filter(
      (account) => account.channel?.code === PlatformCode.MERCADOLIBRE,
    );

    let importedCount = 0;
    let skippedCount = 0;
    const errors: Array<{ accountId: string; message: string }> = [];

    for (const account of mercadoLibreAccounts) {
      try {
        const result = await this.ordersImportService.importOrders(account.id, { limit: 10 });
        importedCount += result.importedCount;
        skippedCount += result.skippedCount;
      } catch (error) {
        errors.push({
          accountId: account.id,
          message: error instanceof Error ? error.message : 'No pudimos refrescar las ordenes',
        });
      }
    }

    const snapshots = await this.refreshOpenSnapshots(accountId);

    return {
      accountsProcessed: mercadoLibreAccounts.length,
      importedCount,
      skippedCount,
      refreshedOpenOrders: snapshots.refreshed,
      errors,
    };
  }

  async downloadShippingLabel(orderId: string) {
    const order = await this.ordersOrmRepository.findOne({
      where: { id: orderId },
      relations: {
        account: true,
        channel: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }

    if (order.channel?.code !== PlatformCode.MERCADOLIBRE) {
      throw new BadRequestException('Only Mercado Libre orders have official shipping labels');
    }

    const shipmentId = this.extractShipmentId(order.rawPayload);
    if (!shipmentId) {
      throw new BadRequestException('This order does not have a Mercado Libre shipment id');
    }

    const accessToken = await this.resolveMercadoLibreAccessToken(
      order.accountId,
      new Map<string, string | null>(),
    );

    if (!accessToken) {
      throw new BadRequestException('Mercado Libre access token is not available for this account');
    }

    const response = await this.mercadoLibreApiClient.requestBinary('/shipment_labels', {
      method: 'GET',
      accessToken,
      query: {
        shipment_ids: shipmentId,
        response_type: 'pdf',
      },
      headers: {
        Accept: 'application/pdf',
      },
    });

    return {
      body: response.body,
      contentType: response.contentType ?? 'application/pdf',
      contentDisposition:
        response.contentDisposition ??
        `inline; filename=\"shipping-label-${order.orderNumber}.pdf\"`,
    };
  }

  async downloadShippingLabels(orderIds: string[]) {
    const uniqueOrderIds = Array.from(new Set(orderIds.filter(Boolean)));

    if (uniqueOrderIds.length === 0) {
      throw new BadRequestException('At least one order id is required');
    }

    const orders = await this.ordersOrmRepository.find({
      where: uniqueOrderIds.map((id) => ({ id })),
      relations: {
        account: true,
        channel: true,
      },
    });

    if (orders.length !== uniqueOrderIds.length) {
      throw new NotFoundException('Some orders were not found');
    }

    const nonMercadoLibreOrder = orders.find((order) => order.channel?.code !== PlatformCode.MERCADOLIBRE);
    if (nonMercadoLibreOrder) {
      throw new BadRequestException('Bulk labels are only available for Mercado Libre orders');
    }

    const ordersByAccountId = new Map<string, Order[]>();

    for (const order of orders) {
      const accountOrders = ordersByAccountId.get(order.accountId) ?? [];
      accountOrders.push(order);
      ordersByAccountId.set(order.accountId, accountOrders);
    }

    const accessTokenByAccountId = new Map<string, string | null>();
    const mergedPdf = await PDFDocument.create();

    for (const [accountId, accountOrders] of ordersByAccountId.entries()) {
      const shipmentIds = accountOrders
        .map((order) => this.extractShipmentId(order.rawPayload))
        .filter((shipmentId): shipmentId is string => Boolean(shipmentId));

      if (shipmentIds.length === 0) {
        continue;
      }

      const accessToken = await this.resolveMercadoLibreAccessToken(
        accountId,
        accessTokenByAccountId,
      );

      if (!accessToken) {
        throw new BadRequestException(
          `Mercado Libre access token is not available for account ${accountOrders[0]!.account.name}`,
        );
      }

      const response = await this.mercadoLibreApiClient.requestBinary('/shipment_labels', {
        method: 'GET',
        accessToken,
        query: {
          shipment_ids: Array.from(new Set(shipmentIds)).join(','),
          response_type: 'pdf',
        },
        headers: {
          Accept: 'application/pdf',
        },
      });

      const sourcePdf = await PDFDocument.load(response.body);
      const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());

      for (const page of copiedPages) {
        mergedPdf.addPage(page);
      }
    }

    if (mergedPdf.getPageCount() === 0) {
      throw new BadRequestException('No shipment labels were generated for the selected orders');
    }

    const labelCount = mergedPdf.getPageCount();
    const mergedPdfBytes = await mergedPdf.save();

    return {
      body: Buffer.from(mergedPdfBytes),
      contentType: 'application/pdf',
      contentDisposition:
        `inline; filename=\"shipping-labels-${labelCount}.pdf\"`,
    };
  }

  private async buildProductSummaries(
    orders: Order[],
    options?: { refreshShippingSnapshot?: boolean },
  ) {
    const summaries = new Map<
      string,
      {
        productTitle: string | null;
        productImageUrl: string | null;
        shippingType: 'flex' | 'mercado_envios' | null;
        shippingStatus: string | null;
        shippingSubstatus: string | null;
        shippingSlaStatus: string | null;
        shippingExpectedDate: string | null;
        shippingDeliveredAt: string | null;
        shippingStage:
          | 'ready_to_print'
          | 'ready_to_ship'
          | 'shipped'
          | 'delivered'
          | 'cancelled'
        | 'rescheduled'
        | null;
      }
    >();
    const contexts = orders.map((order) => {
      const firstItem = order.items[0];

      return {
        order,
        summary: this.extractProductSummary(order),
        linkedListingExternalId: firstItem?.listing?.externalListingId ?? null,
        listingMetadata:
          (firstItem?.listing?.metadata as Record<string, unknown> | null | undefined) ?? null,
        externalItemId: firstItem?.externalItemId ?? this.extractExternalItemId(order.rawPayload),
      };
    });

    const accessTokenByAccountId = new Map<string, string | null>();
    const shippingSummaryByShipmentId = new Map<string, ShippingSummary | null>();
    const shippingSlaByShipmentId = new Map<string, ShipmentSlaResponse | null>();
    const listingMetadataByKey = new Map<string, Record<string, unknown> | null>();
    const uniqueItemRefs = new Map<string, { accountId: string; externalItemId: string }>();
    const remoteItemImageByKey = new Map<string, string | null>();

    const refreshShippingSnapshot = options?.refreshShippingSnapshot ?? false;

    await Promise.all(
      contexts.map(async (context) => {
        const hasLocalShippingSnapshot =
          Boolean(context.order.shippingType) ||
          Boolean(context.order.shippingStatus) ||
          Boolean(context.order.shippingSubstatus) ||
          Boolean(context.order.shippingStage);
        const requiresExpectedDateRefresh =
          Boolean(context.order.shippingStage) &&
          ['ready_to_print', 'ready_to_ship', 'shipped', 'delivered'].includes(
            context.order.shippingStage ?? '',
          ) &&
          !context.order.shippingExpectedDate;

        if (hasLocalShippingSnapshot && !requiresExpectedDateRefresh && !refreshShippingSnapshot) {
          return;
        }

        const shippingSummary = await this.resolveShippingSummary(
          context.order,
          accessTokenByAccountId,
          shippingSummaryByShipmentId,
          shippingSlaByShipmentId,
        );

        if (!shippingSummary) {
          return;
        }

        context.order.shippingType = shippingSummary.shippingType ?? context.order.shippingType ?? null;
        context.order.shippingStatus =
          shippingSummary.shippingStatus ?? context.order.shippingStatus ?? null;
        context.order.shippingSubstatus =
          shippingSummary.shippingSubstatus ?? context.order.shippingSubstatus ?? null;
        context.order.rawPayload = {
          ...(context.order.rawPayload ?? {}),
          _eselink_shipping_sla_status: shippingSummary.shippingSlaStatus,
        };
        context.order.shippingStage = shippingSummary.shippingStage ?? context.order.shippingStage ?? null;
        context.order.shippingExpectedDate = shippingSummary.estimatedDeliveryDate
          ? new Date(shippingSummary.estimatedDeliveryDate)
          : null;
        context.order.shippingSyncedAt = new Date();
      }),
    );

    const ordersWithShippingBackfill = contexts
      .map((context) => context.order)
      .filter((order) => Boolean(order.shippingSyncedAt));

    if (ordersWithShippingBackfill.length > 0) {
      await this.ordersOrmRepository.save(ordersWithShippingBackfill);
    }

    for (const context of contexts) {
      const shouldUseLinkedListingMetadata =
        !context.externalItemId || context.linkedListingExternalId === context.externalItemId;
      const linkedListingImage = shouldUseLinkedListingMetadata
        ? this.extractImageUrlFromListingMetadata(context.listingMetadata)
        : null;

      if (
        !context.summary.productImageUrl &&
        !linkedListingImage &&
        context.externalItemId
      ) {
        const key = `${context.order.accountId}:${context.externalItemId}`;
        if (!uniqueItemRefs.has(key)) {
          uniqueItemRefs.set(key, {
            accountId: context.order.accountId,
            externalItemId: context.externalItemId,
          });
        }
      }
    }

    await Promise.all(
      Array.from(uniqueItemRefs.values()).map(async ({ accountId, externalItemId }) => {
        const listing = await this.listingsRepository.findOne({
          where: {
            accountId,
            externalListingId: externalItemId,
          },
          select: {
            id: true,
            metadata: true,
          },
        });

        listingMetadataByKey.set(
          `${accountId}:${externalItemId}`,
          (listing?.metadata as Record<string, unknown> | null | undefined) ?? null,
        );
      }),
    );

    await Promise.all(
      Array.from(uniqueItemRefs.values()).map(async ({ accountId, externalItemId }) => {
        const key = `${accountId}:${externalItemId}`;

        if (listingMetadataByKey.get(key)) {
          return;
        }

        const accessToken = await this.resolveMercadoLibreAccessToken(
          accountId,
          accessTokenByAccountId,
        );

        if (!accessToken) {
          remoteItemImageByKey.set(key, null);
          return;
        }

        try {
          const item = await this.mercadoLibreApiClient.request<MercadoLibreItemImageResponse>(
            `/items/${externalItemId}`,
            {
              method: 'GET',
              accessToken,
            },
          );

          remoteItemImageByKey.set(key, this.extractImageUrlFromMercadoLibreItem(item));
        } catch {
          remoteItemImageByKey.set(key, null);
        }
      }),
    );

    for (const context of contexts) {
      const fallbackKey = context.externalItemId
        ? `${context.order.accountId}:${context.externalItemId}`
        : null;
      const fallbackListingMetadata = fallbackKey ? listingMetadataByKey.get(fallbackKey) ?? null : null;
      const remoteItemImage = fallbackKey ? remoteItemImageByKey.get(fallbackKey) ?? null : null;
      const shouldUseLinkedListingMetadata =
        !context.externalItemId || context.linkedListingExternalId === context.externalItemId;
      const linkedListingImage = shouldUseLinkedListingMetadata
        ? this.extractImageUrlFromListingMetadata(context.listingMetadata)
        : null;

      context.summary.productImageUrl =
        context.summary.productImageUrl ??
        linkedListingImage ??
        this.extractImageUrlFromListingMetadata(fallbackListingMetadata) ??
        remoteItemImage ??
        null;
      context.summary.shippingType = (context.order.shippingType as
        | 'flex'
        | 'mercado_envios'
        | null) ?? null;
      context.summary.shippingStatus = context.order.shippingStatus ?? null;
      context.summary.shippingSubstatus = context.order.shippingSubstatus ?? null;
      context.summary.shippingSlaStatus = this.extractShippingSlaStatus(context.order.rawPayload);
      context.summary.shippingExpectedDate = context.order.shippingExpectedDate?.toISOString() ?? null;
      context.summary.shippingDeliveredAt =
        shippingSummaryByShipmentId.get(this.extractShipmentId(context.order.rawPayload) ?? '')
          ?.deliveredAt ?? null;
      context.summary.shippingStage = (context.order.shippingStage as
        | 'ready_to_print'
        | 'ready_to_ship'
        | 'shipped'
        | 'delivered'
        | 'cancelled'
        | 'rescheduled'
        | null) ?? null;

      summaries.set(context.order.id, context.summary);
    }

    return summaries;
  }

  private extractProductSummary(order: Order) {
    const firstItem = order.items[0];

    return {
      productTitle: firstItem?.title ?? this.extractProductTitle(order.rawPayload) ?? null,
      productImageUrl: this.extractImageUrlFromPayload(order.rawPayload),
      shippingType: null as 'flex' | 'mercado_envios' | null,
      shippingStatus: null as string | null,
      shippingSubstatus: null as string | null,
      shippingSlaStatus: null as string | null,
      shippingExpectedDate: null as string | null,
      shippingDeliveredAt: null as string | null,
      shippingStage: null as
        | 'ready_to_print'
        | 'ready_to_ship'
        | 'shipped'
        | 'delivered'
        | 'cancelled'
        | 'rescheduled'
        | null,
    };
  }

  private async resolveMercadoLibreAccessToken(
    accountId: string,
    accessTokenByAccountId: Map<string, string | null>,
  ) {
    const cached = accessTokenByAccountId.get(accountId);
    if (cached !== undefined) {
      return cached;
    }

    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
      relations: {
        channel: true,
        connections: true,
      },
    });

    if (!account || account.channel.code !== 'mercadolibre') {
      accessTokenByAccountId.set(accountId, null);
      return null;
    }

    const accessToken = await this.mercadoLibreAuthService.ensureAccessToken(account.id);
    accessTokenByAccountId.set(accountId, accessToken);
    return accessToken;
  }

  private extractPurchaseSummary(order: Order, purchaseGroupSizes: Map<string, number>) {
    const packId = this.extractPackId(order.rawPayload);
    const purchaseGroupId = this.buildPurchaseGroupId(order, packId);

    return {
      packId,
      purchaseGroupId,
      purchaseGroupSize: purchaseGroupSizes.get(purchaseGroupId) ?? 1,
      isPackOrder: packId !== null,
    };
  }

  private async filterOrdersWithShippingToday(orders: Order[], requestedShippingDate?: string) {
    const groupedByAccount = new Map<string, Order[]>();

    for (const order of orders) {
      const group = groupedByAccount.get(order.accountId) ?? [];
      group.push(order);
      groupedByAccount.set(order.accountId, group);
    }

    const results = await Promise.all(
      Array.from(groupedByAccount.entries()).map(async ([accountId, accountOrders]) => {
        const account = await this.accountsRepository.findOne({
          where: { id: accountId },
          relations: {
            channel: true,
            connections: true,
            workspace: true,
          },
        });

        if (!account || account.channel.code !== 'mercadolibre') {
          return [] as Order[];
        }

        const timeZone = this.resolveOrderTimeZone(account);
        const targetDate =
          requestedShippingDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedShippingDate)
            ? requestedShippingDate
            : this.formatDateInTimeZone(new Date(), timeZone);
        const accessTokenByAccountId = new Map<string, string | null>();
        const shippingSummaryByShipmentId = new Map<string, ShippingSummary | null>();
        const shippingSlaByShipmentId = new Map<string, ShipmentSlaResponse | null>();

        const accountResults = await Promise.all(
          accountOrders.map(async (order) => {
            const shipmentId = this.extractShipmentId(order.rawPayload);
            if (!shipmentId) {
              return null;
            }

            try {
              const shippingSummary = await this.resolveShippingSummary(
                order,
                accessTokenByAccountId,
                shippingSummaryByShipmentId,
                shippingSlaByShipmentId,
              );

              if (!shippingSummary) {
                return null;
              }
              const orderDate = this.resolveOrderDateKey(order, timeZone);
              const shippingDate = shippingSummary?.estimatedDeliveryDate
                ? this.formatDateInTimeZone(new Date(shippingSummary.estimatedDeliveryDate), timeZone)
                : null;
              const deliveredDate = shippingSummary?.deliveredAt
                ? this.formatDateInTimeZone(new Date(shippingSummary.deliveredAt), timeZone)
                : null;
              const stage = shippingSummary?.shippingStage ?? null;
              const shippingType =
                (shippingSummary?.shippingType as 'flex' | 'mercado_envios' | null) ??
                ((order.shippingType as 'flex' | 'mercado_envios' | null) ?? null);
              const belongsToTodayByOrderDate = orderDate === targetDate;
              const keepMercadoEnviosForCurrentDay =
                shippingType === 'mercado_envios' && belongsToTodayByOrderDate;
              const hasFutureShippingDate =
                shippingDate !== null &&
                shippingDate > targetDate &&
                ['ready_to_print', 'ready_to_ship'].includes(stage ?? '') &&
                !keepMercadoEnviosForCurrentDay;
              const shipmentUpdatedDate = shippingSummary?.lastUpdated
                ? this.formatDateInTimeZone(new Date(shippingSummary.lastUpdated), timeZone)
                : null;
              const deliveredTodayFromDelay =
                stage === 'delivered' &&
                shippingType === 'flex' &&
                shipmentUpdatedDate === targetDate;

              if (hasFutureShippingDate) {
                return null;
              }

              const belongsToShippingToday =
                stage === 'ready_to_print' || stage === 'ready_to_ship'
                  ? shippingDate === targetDate || (!shippingDate && orderDate === targetDate)
                  : stage === 'shipped'
                    ? shippingType === 'flex' &&
                      shippingDate !== null &&
                      shippingDate <= targetDate
                    : stage === 'rescheduled'
                      ? shippingType === 'flex'
                        ? true
                        : shippingDate === targetDate ||
                          (!shippingDate && shipmentUpdatedDate === targetDate)
                    : stage === 'delivered'
                      ? deliveredDate === targetDate ||
                        (!deliveredDate && (shippingDate === targetDate || deliveredTodayFromDelay))
                      : orderDate === targetDate;

              return (
                (belongsToShippingToday || deliveredTodayFromDelay) &&
                this.shouldIncludeOrderInShippingToday(order, shippingSummary, {
                  includeDelivered: true,
                })
              )
                ? order
                : null;
            } catch {
              return null;
            }
          }),
        );

        return accountResults.filter((order): order is Order => order !== null);
      }),
    );

    return results.flat();
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

  private shouldIncludeOrderInShippingToday(
    order: Order,
    shippingSummary?: ShippingSummary | null,
    options?: { includeDelivered?: boolean },
  ) {
    const includeDelivered = options?.includeDelivered ?? false;
    const internalStatus = order.status?.toLowerCase();
    const externalStatus = order.externalStatus?.toLowerCase();
    const shippingType = shippingSummary?.shippingType ?? ((order.shippingType as
      | 'flex'
      | 'mercado_envios'
      | null) ?? null);
    const shippingStatus =
      shippingSummary?.shippingStatus?.toLowerCase() ?? order.shippingStatus?.toLowerCase() ?? null;
    const shippingStage =
      shippingSummary?.shippingStage ?? ((order.shippingStage as
        | 'ready_to_print'
        | 'ready_to_ship'
        | 'shipped'
        | 'delivered'
        | 'cancelled'
        | 'rescheduled'
        | null) ?? null);

    if (
      shippingType === 'mercado_envios' &&
      ['delivered', 'cancelled', 'rescheduled'].includes(shippingStage ?? '')
    ) {
      return false;
    }

    return (
      (shippingType === 'flex' || shippingType === 'mercado_envios') &&
      internalStatus !== 'cancelled' &&
      (includeDelivered || internalStatus !== 'delivered') &&
      externalStatus !== 'cancelled' &&
      (includeDelivered || externalStatus !== 'delivered') &&
      shippingStatus !== 'cancelled' &&
      (includeDelivered || shippingStatus !== 'delivered')
    );
  }

  private resolveOrderDateKey(order: Order, timeZone: string) {
    const referenceDate = order.placedAt ?? order.importedAt ?? order.createdAt ?? null;

    if (!referenceDate) {
      return null;
    }

    return this.formatDateInTimeZone(referenceDate, timeZone);
  }

  private resolveOrderTimeZone(account: Account) {
    return (
      account.timezone ??
      account.workspace?.timezone ??
      (account.countryCode === 'MLC' ? 'America/Santiago' : 'UTC')
    );
  }

  private async resolveShippingSummary(
    order: Order,
    accessTokenByAccountId: Map<string, string | null>,
    shippingSummaryByShipmentId: Map<string, ShippingSummary | null>,
    shippingSlaByShipmentId: Map<string, ShipmentSlaResponse | null>,
  ) {
    const shipmentId = this.extractShipmentId(order.rawPayload);
    if (!shipmentId) {
      return null;
    }

    const cached = shippingSummaryByShipmentId.get(shipmentId);
    if (cached !== undefined) {
      return cached;
    }

    const accessToken = await this.resolveMercadoLibreAccessToken(
      order.accountId,
      accessTokenByAccountId,
    );

    if (!accessToken) {
      shippingSummaryByShipmentId.set(shipmentId, null);
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

      const shippingSummary = this.buildShippingSummary(shipment);
      const needsHistoricDates =
        shippingSummary.shippingStage === 'delivered' ||
        shippingSummary.shippingStage === 'cancelled';

      if (needsHistoricDates) {
        try {
          const classicShipment =
            await this.mercadoLibreApiClient.request<MercadoLibreShipmentResponse>(
              `/shipments/${shipmentId}`,
              {
                method: 'GET',
                accessToken,
              },
            );
          const classicSummary = this.buildShippingSummary(classicShipment);

          shippingSummary.deliveredAt =
            classicSummary.deliveredAt ?? shippingSummary.deliveredAt;
          shippingSummary.cancelledAt =
            classicSummary.cancelledAt ?? shippingSummary.cancelledAt;

          if (!shippingSummary.estimatedDeliveryDate) {
            shippingSummary.estimatedDeliveryDate = classicSummary.estimatedDeliveryDate;
          }
        } catch {
          // Keep the operational summary even if the classic payload fails.
        }
      }

      let sla = shippingSlaByShipmentId.get(shipmentId);

      if (sla === undefined) {
        try {
          sla = await this.mercadoLibreApiClient.request<ShipmentSlaResponse>(
            `/shipments/${shipmentId}/sla`,
            {
              method: 'GET',
              accessToken,
              headers: {
                'x-format-new': 'true',
              },
            },
          );
        } catch {
          sla = null;
        }

        shippingSlaByShipmentId.set(shipmentId, sla);
      }

      if (!shippingSummary.estimatedDeliveryDate) {
        shippingSummary.estimatedDeliveryDate = sla?.expected_date ?? null;
      }

      shippingSummary.shippingSlaStatus = sla?.status ?? null;
      shippingSummaryByShipmentId.set(shipmentId, shippingSummary);
      return shippingSummary;
    } catch {
      shippingSummaryByShipmentId.set(shipmentId, null);
      return null;
    }
  }

  private extractPackId(rawPayload?: Record<string, unknown> | null) {
    const packId = rawPayload?.pack_id;
    if (typeof packId === 'string' || typeof packId === 'number') {
      return String(packId);
    }

    return null;
  }

  private extractProductTitle(rawPayload?: Record<string, unknown> | null) {
    const orderItems = rawPayload?.order_items;
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return null;
    }

    const firstItem = orderItems[0];
    if (typeof firstItem !== 'object' || firstItem === null) {
      return null;
    }

    const item = (firstItem as { item?: { title?: string } }).item;
    return typeof item?.title === 'string' ? item.title : null;
  }

  private extractExternalItemId(rawPayload?: Record<string, unknown> | null) {
    const orderItems = rawPayload?.order_items;
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return null;
    }

    const firstItem = orderItems[0];
    if (typeof firstItem !== 'object' || firstItem === null) {
      return null;
    }

    const item = (firstItem as { item?: { id?: string } }).item;
    return typeof item?.id === 'string' ? item.id : null;
  }

  private extractTotalUnits(order: Order) {
    const itemsQuantity = order.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    if (itemsQuantity > 0) {
      return itemsQuantity;
    }

    const orderItems = order.rawPayload?.order_items;
    if (Array.isArray(orderItems) && orderItems.length > 0) {
      const payloadQuantity = orderItems.reduce((sum, entry) => {
        if (typeof entry !== 'object' || entry === null) {
          return sum;
        }

        const quantity = (entry as { quantity?: number | string }).quantity;
        const parsedQuantity = Number(quantity ?? 0);
        return sum + (Number.isNaN(parsedQuantity) ? 0 : parsedQuantity);
      }, 0);

      if (payloadQuantity > 0) {
        return payloadQuantity;
      }
    }

    return 1;
  }

  private extractImageUrlFromPayload(rawPayload?: Record<string, unknown> | null) {
    const orderItems = rawPayload?.order_items;
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return null;
    }

    const firstItem = orderItems[0];
    if (typeof firstItem !== 'object' || firstItem === null) {
      return null;
    }

    const item = (
      firstItem as {
        item?: {
          thumbnail?: string;
          picture_url?: string;
          pictures?: Array<{ url?: string }>;
        };
      }
    ).item;

    if (typeof item?.thumbnail === 'string') {
      return item.thumbnail;
    }

    if (typeof item?.picture_url === 'string') {
      return item.picture_url;
    }

    const firstPicture = item?.pictures?.[0];
    return typeof firstPicture?.url === 'string' ? firstPicture.url : null;
  }

  private extractShippingSlaStatus(rawPayload?: Record<string, unknown> | null) {
    const value = rawPayload?._eselink_shipping_sla_status;
    return typeof value === 'string' ? value : null;
  }

  private extractImageUrlFromListingMetadata(metadata?: Record<string, unknown> | null) {
    if (!metadata) {
      return null;
    }

    if (typeof metadata.thumbnail === 'string') {
      return metadata.thumbnail;
    }

    const pictures = metadata.pictures;
    if (!Array.isArray(pictures) || pictures.length === 0) {
      return null;
    }

    const firstPicture = pictures[0];
    if (typeof firstPicture !== 'object' || firstPicture === null) {
      return null;
    }

    const url = (firstPicture as { url?: string }).url;
    return typeof url === 'string' ? url : null;
  }

  private extractImageUrlFromMercadoLibreItem(item?: MercadoLibreItemImageResponse | null) {
    if (!item) {
      return null;
    }

    if (typeof item.thumbnail === 'string') {
      return item.thumbnail;
    }

    const firstPicture = item.pictures?.[0];
    return typeof firstPicture?.url === 'string' ? firstPicture.url : null;
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
    const shippingType = this.mapShippingType(shipment);
    const shippingStatus = shipment?.status?.toLowerCase() ?? null;
    const shippingSubstatus = shipment?.substatus?.toLowerCase() ?? null;
    const isFlexRescheduled =
      shippingType === 'flex' &&
      [
        'rescheduled',
        'reprogrammed',
        'reprogramado',
        'buyer_rescheduled',
        'receiver_absent',
        'rescheduled_by_meli',
      ].includes(shippingSubstatus ?? '');

    if (shippingStatus === 'cancelled') {
      return 'cancelled';
    }

    if (shippingStatus === 'delivered') {
      return 'delivered';
    }

    if (isFlexRescheduled) {
      return 'rescheduled';
    }

    if (shippingStatus === 'shipped') {
      return 'shipped';
    }

    // Mercado Libre can keep the shipment in ready_to_ship even after
    // logistics already took custody. Those scanned custody substatuses
    // should be treated as in transit in the operational UI.
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

  private buildShippingSummary(shipment?: MercadoLibreShipmentResponse | null): ShippingSummary {
    return {
      shippingType: this.mapShippingType(shipment),
      shippingStatus: shipment?.status ?? null,
      shippingSubstatus: shipment?.substatus ?? null,
      shippingSlaStatus: null,
      lastUpdated: shipment?.last_updated ?? null,
      shippingStage: this.mapShippingStage(shipment),
      estimatedDeliveryDate:
        shipment?.shipping_option?.estimated_delivery_final?.date ??
        shipment?.shipping_option?.estimated_delivery_limit?.date ??
        shipment?.shipping_option?.estimated_delivery_time?.date ??
        null,
      deliveredAt: shipment?.status_history?.date_delivered ?? null,
      cancelledAt: shipment?.status_history?.date_cancelled ?? null,
    };
  }

  private buildPurchaseGroupSizes(orders: Order[]) {
    const purchaseGroupSizes = new Map<string, number>();

    for (const order of orders) {
      const purchaseGroupId = this.buildPurchaseGroupId(
        order,
        this.extractPackId(order.rawPayload),
      );
      purchaseGroupSizes.set(
        purchaseGroupId,
        (purchaseGroupSizes.get(purchaseGroupId) ?? 0) + 1,
      );
    }

    return purchaseGroupSizes;
  }

  private buildPurchaseGroupId(order: Order, packId?: string | null) {
    const platformCode = order.channel?.code ?? 'unknown';
    const baseGroupId = packId ?? order.externalOrderId;

    return `${platformCode}:${baseGroupId}`;
  }

  private extractCustomerSummary(order: Order) {
    const customerNickname = this.extractBuyerNickname(order.rawPayload);
    const customerFullName = this.extractBuyerFullName(order.rawPayload);
    const fallbackName = order.customerName?.trim() || null;
    const customerDisplayName = customerFullName ?? fallbackName ?? customerNickname ?? null;

    return {
      customerName: customerDisplayName,
      customerDisplayName,
      customerNickname,
    };
  }

  private extractBuyerNickname(rawPayload?: Record<string, unknown> | null) {
    const buyer =
      rawPayload?.buyer && typeof rawPayload.buyer === 'object' ? rawPayload.buyer : null;

    if (!buyer) {
      return null;
    }

    const nickname = (buyer as { nickname?: unknown }).nickname;
    return typeof nickname === 'string' && nickname.trim().length > 0 ? nickname.trim() : null;
  }

  private extractBuyerFullName(rawPayload?: Record<string, unknown> | null) {
    const buyer =
      rawPayload?.buyer && typeof rawPayload.buyer === 'object' ? rawPayload.buyer : null;

    if (!buyer) {
      return null;
    }

    const firstName = (buyer as { first_name?: unknown }).first_name;
    const lastName = (buyer as { last_name?: unknown }).last_name;
    const fullName = [firstName, lastName]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim())
      .join(' ')
      .trim();

    return fullName.length > 0 ? fullName : null;
  }

  private calculateProfitAmount(order: Order) {
    if (!order.items.length) {
      return null;
    }

    let totalCost = 0;

    for (const item of order.items) {
      const variant = item.variant as ProductVariant | null | undefined;
      const rawCost = variant?.cost;

      if (rawCost === null || rawCost === undefined) {
        return null;
      }

      const parsedCost = Number(rawCost);
      if (Number.isNaN(parsedCost)) {
        return null;
      }

      totalCost += parsedCost * item.quantity;
    }

    const totalAmount = Number(order.totalAmount);
    return Number.isNaN(totalAmount) ? null : totalAmount - totalCost;
  }

  private formatDateInTimeZone(date: Date, timeZone: string) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  async findOrderDetail(id: string) {
    const order = await this.ordersOrmRepository.findOne({
      where: { id },
      relations: {
        account: true,
        channel: true,
        items: true,
        events: true,
        comments: { user: true },
        assignments: { user: true },
        tags: true,
      },
      order: {
        events: { occurredAt: 'ASC' },
        comments: { createdAt: 'DESC' },
        assignments: { assignedAt: 'DESC' },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }

    const customerSummary = this.extractCustomerSummary(order);

    return {
      order: {
        ...order,
        ...customerSummary,
      },
      mercadolibreFinancials: await this.resolveMercadoLibreFinancialSummary(order),
      items: order.items,
      account: order.account,
      channel: order.channel,
      events: order.events,
      comments: order.comments,
      assignment: order.assignments[0] ?? null,
      tags: order.tags,
    };
  }

  async assignOrder(orderId: string, dto: AssignOrderDto) {
    await this.findOrderDetail(orderId);

    const user = await this.usersRepository.findOne({
      where: { id: dto.user_id },
    });

    if (!user) {
      throw new NotFoundException(`User ${dto.user_id} not found`);
    }

    const existing = await this.orderAssignmentsRepository.findOne({
      where: {
        orderId,
        userId: dto.user_id,
      },
    });

    const assignment =
      existing ??
      this.orderAssignmentsRepository.create({
        orderId,
        userId: dto.user_id,
        workspaceId: await this.operationContextService.getDefaultWorkspaceId(),
      });

    assignment.note = dto.note;
    assignment.assignedAt = new Date();

    return this.orderAssignmentsRepository.save(assignment);
  }

  async listComments(orderId: string) {
    return this.orderCommentsRepository.find({
      where: { orderId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createComment(orderId: string, dto: CreateOrderCommentDto) {
    await this.findOrderDetail(orderId);

    const user = await this.usersRepository.findOne({
      where: { id: dto.user_id },
    });

    if (!user) {
      throw new NotFoundException(`User ${dto.user_id} not found`);
    }

    const comment = this.orderCommentsRepository.create({
      workspaceId: await this.operationContextService.getDefaultWorkspaceId(),
      orderId,
      userId: dto.user_id,
      body: dto.body,
      isInternal: dto.is_internal ?? true,
    });

    return this.orderCommentsRepository.save(comment);
  }

  private async resolveMercadoLibreFinancialSummary(order: Order) {
    const storedSummary = this.getStoredMercadoLibreFinancialSummary(order.rawPayload);
    if (storedSummary) {
      return storedSummary;
    }

    const computedSummary = await this.extractMercadoLibreFinancialSummary(order);

    if (computedSummary && order.channel?.code === PlatformCode.MERCADOLIBRE) {
      order.rawPayload = {
        ...(order.rawPayload ?? {}),
        _eselink_financial_summary: computedSummary,
      };
      await this.ordersOrmRepository.save(order);
    }

    return computedSummary;
  }

  private async extractMercadoLibreFinancialSummary(order: Order) {
    const rawPayments = order.rawPayload?.payments;
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

    const remotePaymentDetails = await this.fetchMercadoPagoPaymentDetails(
      order.accountId,
      payments
        .map((payment) => payment.id)
        .filter((id): id is string | number => typeof id === 'string' || typeof id === 'number'),
    );

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

    const shippingCostFromPayments =
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

    const customerShippingAmount = Number(order.shippingAmount ?? 0);
    const shippingCost =
      shippingCostFromPayments > 0 ? shippingCostFromPayments : customerShippingAmount;
    const saleBase = transactionAmount > 0 ? transactionAmount : Number(order.totalAmount ?? 0);
    const netReceivedAmount = this.sumMercadoPagoNetReceivedAmount(remotePaymentDetails);
    const mlCharges = marketplaceFee + taxesAmount + shippingCost;
    const baseNet = saleBase - mlCharges;
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

  private sumPaymentField(payments: Array<Record<string, unknown>>, field: string) {
    return payments.reduce((sum, payment) => {
      const value = Number(payment[field] ?? 0);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  private getStoredMercadoLibreFinancialSummary(
    rawPayload?: Record<string, unknown> | null,
  ): StoredMercadoLibreFinancialSummary | null {
    const summary = rawPayload?._eselink_financial_summary;
    if (typeof summary !== 'object' || summary === null) {
      return null;
    }

    const record = summary as Record<string, unknown>;
    const saleBase = Number(record.saleBase ?? 0);
    const customerShippingAmount = Number(record.customerShippingAmount ?? 0);
    const totalPaidAmount = Number(record.totalPaidAmount ?? 0);
    const marketplaceFee = Number(record.marketplaceFee ?? 0);
    const taxesAmount = Number(record.taxesAmount ?? 0);
    const shippingCost = Number(record.shippingCost ?? 0);
    const bonusAmount = Number(record.bonusAmount ?? 0);
    const couponAmount = Number(record.couponAmount ?? 0);
    const estimatedNetBeforeCost = Number(record.estimatedNetBeforeCost ?? 0);
    const installmentsValue = Number(record.installments ?? 0);

    if (
      ![
        saleBase,
        customerShippingAmount,
        totalPaidAmount,
        marketplaceFee,
        taxesAmount,
        shippingCost,
        bonusAmount,
        couponAmount,
        estimatedNetBeforeCost,
      ].every(Number.isFinite)
    ) {
      return null;
    }

    return {
      saleBase,
      customerShippingAmount,
      totalPaidAmount,
      marketplaceFee,
      taxesAmount,
      shippingCost,
      bonusAmount,
      couponAmount,
      installments: Number.isFinite(installmentsValue) && installmentsValue > 0 ? installmentsValue : null,
      authorizationCode:
        typeof record.authorizationCode === 'string' && record.authorizationCode.trim().length > 0
          ? record.authorizationCode.trim()
          : null,
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
