import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OrderTagsRepository } from './order-tags.repository.js';

@Injectable()
export class OrderTagsService extends BaseDomainService {
  constructor(repository: OrderTagsRepository) {
    super(repository);
  }
}
