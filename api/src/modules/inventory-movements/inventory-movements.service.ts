import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { InventoryMovementsRepository } from './inventory-movements.repository.js';

@Injectable()
export class InventoryMovementsService extends BaseDomainService {
  constructor(repository: InventoryMovementsRepository) {
    super(repository);
  }
}
