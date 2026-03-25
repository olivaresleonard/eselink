import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { SkuMapping } from './sku-mapping.entity.js';

@Injectable()
export class SkuMappingsRepository extends BaseTypeOrmRepository<SkuMapping> {
  constructor(@InjectRepository(SkuMapping) repository: Repository<SkuMapping>) {
    super(repository, 'sku-mappings');
  }
}
