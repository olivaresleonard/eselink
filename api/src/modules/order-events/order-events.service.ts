import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OrderEventsRepository } from './order-events.repository.js';

@Injectable()
export class OrderEventsService extends BaseDomainService {
  constructor(repository: OrderEventsRepository) {
    super(repository);
  }
}
