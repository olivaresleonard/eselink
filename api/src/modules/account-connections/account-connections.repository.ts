import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { AccountConnection } from './account-connection.entity.js';

@Injectable()
export class AccountConnectionsRepository extends BaseTypeOrmRepository<AccountConnection> {
  constructor(@InjectRepository(AccountConnection) repository: Repository<AccountConnection>) {
    super(repository, 'account-connections');
  }
}
