import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { OrderItemsService } from './order-items.service.js';

@Controller('order-items')
export class OrderItemsController extends BaseDomainController {
  constructor(orderItemsService: OrderItemsService) {
    super(orderItemsService);
  }
}

