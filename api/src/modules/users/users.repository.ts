import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { User } from './user.entity.js';

@Injectable()
export class UsersRepository extends BaseTypeOrmRepository<User> {
  constructor(@InjectRepository(User) repository: Repository<User>) {
    super(repository, 'users');
  }
}
