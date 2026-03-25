import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { OrderComment } from './order-comment.entity.js';

@Injectable()
export class OrderCommentsRepository extends BaseTypeOrmRepository<OrderComment> {
  constructor(@InjectRepository(OrderComment) repository: Repository<OrderComment>) {
    super(repository, 'order-comments');
  }
}
