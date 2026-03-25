import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { Order } from './order.entity.js';

@Injectable()
export class OrdersRepository extends BaseTypeOrmRepository<Order> {
  constructor(@InjectRepository(Order) repository: Repository<Order>) {
    super(repository, 'orders');
  }
}
