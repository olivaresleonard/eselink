import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { OrderItem } from './order-item.entity.js';

@Injectable()
export class OrderItemsRepository extends BaseTypeOrmRepository<OrderItem> {
  constructor(@InjectRepository(OrderItem) repository: Repository<OrderItem>) {
    super(repository, 'order-items');
  }
}
