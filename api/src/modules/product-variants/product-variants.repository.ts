import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { ProductVariant } from './product-variant.entity.js';

@Injectable()
export class ProductVariantsRepository extends BaseTypeOrmRepository<ProductVariant> {
  constructor(@InjectRepository(ProductVariant) repository: Repository<ProductVariant>) {
    super(repository, 'product-variants');
  }
}
