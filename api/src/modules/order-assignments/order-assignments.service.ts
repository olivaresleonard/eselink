import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OrderAssignmentsRepository } from './order-assignments.repository.js';

@Injectable()
export class OrderAssignmentsService extends BaseDomainService {
  constructor(repository: OrderAssignmentsRepository) {
    super(repository);
  }
}
