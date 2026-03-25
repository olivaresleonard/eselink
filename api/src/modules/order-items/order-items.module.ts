import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderItem } from './order-item.entity.js';
import { OrderItemsController } from './order-items.controller.js';
import { OrderItemsRepository } from './order-items.repository.js';
import { OrderItemsService } from './order-items.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([OrderItem])],
  controllers: [OrderItemsController],
  providers: [OrderItemsRepository, OrderItemsService],
  exports: [OrderItemsService],
})
export class OrderItemsModule {}
