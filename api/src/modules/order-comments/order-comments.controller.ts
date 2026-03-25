import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { OrderCommentsService } from './order-comments.service.js';

@Controller('order-comments')
export class OrderCommentsController extends BaseDomainController {
  constructor(orderCommentsService: OrderCommentsService) {
    super(orderCommentsService);
  }
}

