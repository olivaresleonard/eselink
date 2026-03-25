import { Controller, Get, Param } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { SkuMappingsService } from './sku-mappings.service.js';

@Controller('sku-mappings')
export class SkuMappingsController extends BaseDomainController {
  constructor(private readonly skuMappingsService: SkuMappingsService) {
    super(skuMappingsService);
  }

  @Get('external/:externalSku')
  findByExternalSku(@Param('externalSku') externalSku: string) {
    return this.skuMappingsService.findByExternalSku(externalSku);
  }
}
