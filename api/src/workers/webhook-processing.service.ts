import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderEventType, PlatformCode, WebhookStatus } from '../common/entities/domain.enums.js';
import { MercadoLibreService } from '../integrations/mercadolibre/mercadolibre.service.js';
import { Account } from '../modules/accounts/account.entity.js';
import { Listing } from '../modules/listings/listing.entity.js';
import { OrderEvent } from '../modules/order-events/order-event.entity.js';
import { OrdersImportService } from '../modules/orders/orders-import.service.js';
import { Order } from '../modules/orders/order.entity.js';
import { WebhookEvent } from '../modules/webhooks/webhook-event.entity.js';
import type { WebhookProcessingPayload } from './types/sync-job-payloads.js';

@Injectable()
export class WebhookProcessingService {
  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(WebhookEvent)
    private readonly webhooksRepository: Repository<WebhookEvent>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(OrderEvent)
    private readonly orderEventsRepository: Repository<OrderEvent>,
    @InjectRepository(Listing)
    private readonly listingsRepository: Repository<Listing>,
    private readonly mercadoLibreService: MercadoLibreService,
    private readonly ordersImportService: OrdersImportService,
  ) {}

  async execute(data: WebhookProcessingPayload) {
    const event = await this.webhooksRepository.findOne({
      where: { id: data.entityId, workspaceId: data.workspaceId },
    });

    if (!event) {
      throw new NotFoundException(`Webhook event ${data.entityId} not found`);
    }

    const payload = event.payload;
    const resolvedAccountId = data.accountId ?? event.accountId ?? (await this.resolveAccountId(event));

    if (event.platform === PlatformCode.MERCADOLIBRE) {
      await this.mercadoLibreService.processWebhookEvent(event);
    }

    if (
      event.platform === PlatformCode.MERCADOLIBRE &&
      typeof payload.resource === 'string' &&
      payload.resource.includes('/orders/') &&
      resolvedAccountId
    ) {
      const externalOrderId = payload.resource.split('/').pop();
      if (externalOrderId) {
        await this.ordersImportService.importMercadoLibreOrder(resolvedAccountId, externalOrderId);
      }
    }

    if (typeof payload.externalOrderId === 'string' && resolvedAccountId) {
      const order = await this.ordersRepository.findOne({
        where: {
          workspaceId: data.workspaceId,
          accountId: resolvedAccountId,
          externalOrderId: payload.externalOrderId,
        },
      });

      if (order) {
        order.externalStatus =
          typeof payload.status === 'string' ? payload.status : order.externalStatus;
        await this.ordersRepository.save(order);

        await this.orderEventsRepository.save(
          this.orderEventsRepository.create({
            workspaceId: data.workspaceId,
            orderId: order.id,
            type: OrderEventType.WEBHOOK_RECEIVED,
            notes: 'Order updated from webhook event',
            payload,
          }),
        );
      }
    }

    if (typeof payload.externalListingId === 'string') {
      const listing = await this.listingsRepository.findOne({
        where: {
          workspaceId: data.workspaceId,
          externalListingId: payload.externalListingId,
        },
      });

      if (listing) {
        listing.externalStatus =
          typeof payload.status === 'string' ? payload.status : listing.externalStatus;
        await this.listingsRepository.save(listing);
      }
    }

    event.status = WebhookStatus.PROCESSED;
    event.processedAt = new Date();
    event.lastError = null;
    if (!event.accountId && resolvedAccountId) {
      event.accountId = resolvedAccountId;
    }
    await this.webhooksRepository.save(event);
  }

  private async resolveAccountId(event: WebhookEvent) {
    const candidateExternalIds = [
      event.payload.user_id,
      event.payload.userId,
      event.payload.owner_id,
      event.payload.ownerId,
      event.payload.seller_id,
      event.payload.sellerId,
    ]
      .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
      .map((value) => String(value));

    if (candidateExternalIds.length === 0) {
      return undefined;
    }

    const account = await this.accountsRepository.findOne({
      where: {
        workspaceId: event.workspaceId,
        externalId: In(candidateExternalIds),
      },
    });

    return account?.id;
  }
}
