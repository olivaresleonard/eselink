import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { Account } from './account.entity.js';

@Injectable()
export class AccountsRepository extends BaseTypeOrmRepository<Account> {
  constructor(@InjectRepository(Account) repository: Repository<Account>) {
    super(repository, 'accounts');
  }
}
