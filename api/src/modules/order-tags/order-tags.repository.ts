import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { OrderTag } from './order-tag.entity.js';

@Injectable()
export class OrderTagsRepository extends BaseTypeOrmRepository<OrderTag> {
  constructor(@InjectRepository(OrderTag) repository: Repository<OrderTag>) {
    super(repository, 'order-tags');
  }
}
