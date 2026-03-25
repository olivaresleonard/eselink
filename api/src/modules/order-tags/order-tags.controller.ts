import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { OrderTagsService } from './order-tags.service.js';

@Controller('order-tags')
export class OrderTagsController extends BaseDomainController {
  constructor(orderTagsService: OrderTagsService) {
    super(orderTagsService);
  }
}
