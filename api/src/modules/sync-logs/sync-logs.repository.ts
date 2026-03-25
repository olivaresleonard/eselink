import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { SyncLog } from './sync-log.entity.js';

@Injectable()
export class SyncLogsRepository extends BaseTypeOrmRepository<SyncLog> {
  constructor(@InjectRepository(SyncLog) repository: Repository<SyncLog>) {
    super(repository, 'sync-logs');
  }
}
