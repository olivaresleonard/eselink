import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { OrderEventsService } from './order-events.service.js';

@Controller('order-events')
export class OrderEventsController extends BaseDomainController {
  constructor(orderEventsService: OrderEventsService) {
    super(orderEventsService);
  }
}

