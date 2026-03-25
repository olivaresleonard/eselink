import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsModule } from '../../integrations/integrations.module.js';
import { Account } from '../accounts/account.entity.js';
import { InventoryItem } from '../inventory/inventory-item.entity.js';
import { InventoryMovement } from '../inventory-movements/inventory-movement.entity.js';
import { Listing } from '../listings/listing.entity.js';
import { OrderAssignment } from '../order-assignments/order-assignment.entity.js';
import { OrderComment } from '../order-comments/order-comment.entity.js';
import { OrderEvent } from '../order-events/order-event.entity.js';
import { OrderItem } from '../order-items/order-item.entity.js';
import { OrderTag } from '../order-tags/order-tag.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { SkuMapping } from '../sku-mappings/sku-mapping.entity.js';
import { User } from '../users/user.entity.js';
import { Order } from './order.entity.js';
import { OrdersController } from './orders.controller.js';
import { OrdersImportService } from './orders-import.service.js';
import { OrdersRepository } from './orders.repository.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [
    IntegrationsModule,
    TypeOrmModule.forFeature([
      Order,
      Account,
      OrderItem,
      OrderEvent,
      SkuMapping,
      ProductVariant,
      InventoryItem,
      InventoryMovement,
      Listing,
      OrderComment,
      OrderAssignment,
      OrderTag,
      User,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersRepository, OrdersService, OrdersImportService],
  exports: [OrdersService, OrdersImportService],
})
export class OrdersModule {}
