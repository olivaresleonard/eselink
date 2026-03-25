import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { Listing } from './listing.entity.js';

@Injectable()
export class ListingsRepository extends BaseTypeOrmRepository<Listing> {
  constructor(@InjectRepository(Listing) repository: Repository<Listing>) {
    super(repository, 'listings');
  }
}
