import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OrderCommentsRepository } from './order-comments.repository.js';

@Injectable()
export class OrderCommentsService extends BaseDomainService {
  constructor(repository: OrderCommentsRepository) {
    super(repository);
  }
}
