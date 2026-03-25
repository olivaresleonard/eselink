import { Body, Controller, Param, Patch } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { UpdateVariantPriceDto } from './dto/update-variant-price.dto.js';
import { ProductVariantsService } from './product-variants.service.js';

@Controller(['product-variants', 'variants'])
export class ProductVariantsController extends BaseDomainController {
  constructor(private readonly productVariantsService: ProductVariantsService) {
    super(productVariantsService);
  }

  @Patch(':id/price')
  updatePrice(@Param('id') id: string, @Body() dto: UpdateVariantPriceDto) {
    return this.productVariantsService.updatePrice(id, dto);
  }
}
