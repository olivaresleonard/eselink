import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../products/product.entity.js';
import { SyncJobsModule } from '../sync-jobs/sync-jobs.module.js';
import { ProductVariant } from './product-variant.entity.js';
import { ProductVariantsController } from './product-variants.controller.js';
import { ProductVariantsRepository } from './product-variants.repository.js';
import { ProductVariantsService } from './product-variants.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([ProductVariant, Product]), SyncJobsModule],
  controllers: [ProductVariantsController],
  providers: [ProductVariantsRepository, ProductVariantsService],
  exports: [ProductVariantsService],
})
export class ProductVariantsModule {}
