import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InventoryMovementType,
  OrderEventType,
  OrderStatus,
  PlatformCode,
} from '../common/entities/domain.enums.js';
import { ChannelIntegrationResolverService } from '../integrations/channel-integration.service.js';
import { Account } from '../modules/accounts/account.entity.js';
import { InventoryItem } from '../modules/inventory/inventory-item.entity.js';
import { InventoryMovement } from '../modules/inventory-movements/inventory-movement.entity.js';
import { OrderEvent } from '../modules/order-events/order-event.entity.js';
import { OrderItem } from '../modules/order-items/order-item.entity.js';
import { Order } from '../modules/orders/order.entity.js';
import { OrdersImportService as DomainOrdersImportService } from '../modules/orders/orders-import.service.js';
import { ProductVariant } from '../modules/product-variants/product-variant.entity.js';
import type { OrdersImportPayload } from './types/sync-job-payloads.js';

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
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemsRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryMovement)
    private readonly inventoryMovementsRepository: Repository<InventoryMovement>,
    private readonly integrationResolver: ChannelIntegrationResolverService,
    private readonly domainOrdersImportService: DomainOrdersImportService,
  ) {}

  async execute(data: OrdersImportPayload) {
    if (!data.accountId) {
      throw new NotFoundException('orders-import requires accountId');
    }

    const account = await this.accountsRepository.findOne({
      where: { id: data.accountId },
      relations: { channel: true },
    });

    if (!account) {
      throw new NotFoundException(`Account ${data.accountId} not found`);
    }

    if (account.channel.code === PlatformCode.MERCADOLIBRE) {
      await this.domainOrdersImportService.importOrders(account.id);
      account.lastOrdersSyncAt = new Date();
      account.lastSyncAt = new Date();
      await this.accountsRepository.save(account);
      return;
    }

    const integration = this.integrationResolver.resolve(account.channel.code);
    const externalOrders = await integration.fetchOrders({
      accountExternalId: account.externalId,
      payload: data.payload,
    });

    for (const externalOrder of externalOrders) {
      const existingOrder = await this.ordersRepository.findOne({
        where: {
          workspaceId: data.workspaceId,
          accountId: account.id,
          externalOrderId: externalOrder.externalOrderId,
        },
      });

      if (existingOrder) {
        continue;
      }

      const order = await this.ordersRepository.save(
        this.ordersRepository.create({
          workspaceId: data.workspaceId,
          accountId: account.id,
          channelId: account.channelId,
          externalOrderId: externalOrder.externalOrderId,
          orderNumber: externalOrder.orderNumber,
          status: OrderStatus.PENDING,
          externalStatus: externalOrder.status,
          currency: externalOrder.currency ?? account.currency,
          customerName: externalOrder.customerName,
          customerEmail: externalOrder.customerEmail,
          totalAmount: String(externalOrder.totalAmount),
          importedAt: new Date(),
          rawPayload: externalOrder.rawPayload ?? externalOrder,
        }),
      );

      for (const item of externalOrder.items) {
        const variant = item.externalSku
          ? await this.variantsRepository.findOne({
              where: {
                workspaceId: data.workspaceId,
                sku: item.externalSku,
              },
            })
          : null;

        await this.orderItemsRepository.save(
          this.orderItemsRepository.create({
            workspaceId: data.workspaceId,
            orderId: order.id,
            variantId: variant?.id,
            externalItemId: item.externalItemId,
            externalSku: item.externalSku,
            title: item.title,
            quantity: item.quantity,
            currency: item.currency ?? order.currency,
            unitPrice: String(item.unitPrice),
            totalAmount: String(item.totalAmount ?? item.quantity * item.unitPrice),
          }),
        );

        if (!variant) {
          continue;
        }

        const inventoryItem = await this.inventoryItemsRepository.findOne({
          where: {
            workspaceId: data.workspaceId,
            variantId: variant.id,
          },
        });

        if (!inventoryItem) {
          continue;
        }

        const newAvailable = inventoryItem.available - item.quantity;
        inventoryItem.available = newAvailable;
        inventoryItem.reserved += item.quantity;
        await this.inventoryItemsRepository.save(inventoryItem);

        await this.inventoryMovementsRepository.save(
          this.inventoryMovementsRepository.create({
            workspaceId: data.workspaceId,
            inventoryItemId: inventoryItem.id,
            type: InventoryMovementType.RESERVATION,
            quantity: item.quantity,
            previousAvailable: inventoryItem.available + item.quantity,
            newAvailable,
            referenceType: 'order',
            referenceId: order.id,
            reason: 'Inventory reserved by imported order',
          }),
        );
      }

      await this.orderEventsRepository.save(
        this.orderEventsRepository.create({
          workspaceId: data.workspaceId,
          orderId: order.id,
          type: OrderEventType.IMPORTED,
          notes: 'Order imported from external channel',
          payload: externalOrder.rawPayload ?? externalOrder,
        }),
      );
    }

    account.lastOrdersSyncAt = new Date();
    account.lastSyncAt = new Date();
    await this.accountsRepository.save(account);
  }
}
