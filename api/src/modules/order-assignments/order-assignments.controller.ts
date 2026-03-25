import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { OrderAssignmentsService } from './order-assignments.service.js';

@Controller('order-assignments')
export class OrderAssignmentsController extends BaseDomainController {
  constructor(orderAssignmentsService: OrderAssignmentsService) {
    super(orderAssignmentsService);
  }
}

