import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { OrderEvent } from './order-event.entity.js';

@Injectable()
export class OrderEventsRepository extends BaseTypeOrmRepository<OrderEvent> {
  constructor(@InjectRepository(OrderEvent) repository: Repository<OrderEvent>) {
    super(repository, 'order-events');
  }
}
