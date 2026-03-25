import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { InventoryMovementsService } from './inventory-movements.service.js';

@Controller('inventory-movements')
export class InventoryMovementsController extends BaseDomainController {
  constructor(inventoryMovementsService: InventoryMovementsService) {
    super(inventoryMovementsService);
  }
}

