import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { Product } from './product.entity.js';

@Injectable()
export class ProductsRepository extends BaseTypeOrmRepository<Product> {
  constructor(@InjectRepository(Product) repository: Repository<Product>) {
    super(repository, 'products');
  }
}
