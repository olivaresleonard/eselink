import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OrderItemsRepository } from './order-items.repository.js';

@Injectable()
export class OrderItemsService extends BaseDomainService {
  constructor(repository: OrderItemsRepository) {
    super(repository);
  }
}
