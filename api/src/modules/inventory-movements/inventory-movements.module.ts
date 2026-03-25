import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryMovement } from './inventory-movement.entity.js';
import { InventoryMovementsController } from './inventory-movements.controller.js';
import { InventoryMovementsRepository } from './inventory-movements.repository.js';
import { InventoryMovementsService } from './inventory-movements.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryMovement])],
  controllers: [InventoryMovementsController],
  providers: [InventoryMovementsRepository, InventoryMovementsService],
  exports: [InventoryMovementsService],
})
export class InventoryMovementsModule {}
