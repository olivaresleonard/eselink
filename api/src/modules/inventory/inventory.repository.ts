import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { InventoryItem } from './inventory-item.entity.js';

@Injectable()
export class InventoryRepository extends BaseTypeOrmRepository<InventoryItem> {
  constructor(@InjectRepository(InventoryItem) repository: Repository<InventoryItem>) {
    super(repository, 'inventory');
  }
}
