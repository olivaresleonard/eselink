import { Body, Controller, Post } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController extends BaseDomainController {
  constructor(private readonly productsService: ProductsService) {
    super(productsService);
  }

  @Post('generate-internal-image')
  generateInternalImage(@Body() body: Record<string, unknown>) {
    return this.productsService.generateInternalImage(body);
  }
}
