import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { OrderAssignment } from './order-assignment.entity.js';

@Injectable()
export class OrderAssignmentsRepository extends BaseTypeOrmRepository<OrderAssignment> {
  constructor(@InjectRepository(OrderAssignment) repository: Repository<OrderAssignment>) {
    super(repository, 'order-assignments');
  }
}
