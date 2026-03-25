import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { SkuMapping } from './sku-mapping.entity.js';
import { SkuMappingsController } from './sku-mappings.controller.js';
import { SkuMappingsRepository } from './sku-mappings.repository.js';
import { SkuMappingsService } from './sku-mappings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([SkuMapping, ProductVariant, Account])],
  controllers: [SkuMappingsController],
  providers: [SkuMappingsRepository, SkuMappingsService],
  exports: [SkuMappingsService],
})
export class SkuMappingsModule {}
