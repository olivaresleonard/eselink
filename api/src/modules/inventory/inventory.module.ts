import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryMovement } from '../inventory-movements/inventory-movement.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { SyncJobsModule } from '../sync-jobs/sync-jobs.module.js';
import { InventoryItem } from './inventory-item.entity.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryRepository } from './inventory.repository.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryItem, InventoryMovement, ProductVariant]), SyncJobsModule],
  controllers: [InventoryController],
  providers: [InventoryRepository, InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
