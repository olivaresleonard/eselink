import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { InventoryMovement } from './inventory-movement.entity.js';

@Injectable()
export class InventoryMovementsRepository extends BaseTypeOrmRepository<InventoryMovement> {
  constructor(@InjectRepository(InventoryMovement) repository: Repository<InventoryMovement>) {
    super(repository, 'inventory-movements');
  }
}
