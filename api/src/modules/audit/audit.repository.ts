import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { AuditEntry } from './audit-entry.entity.js';

@Injectable()
export class AuditRepository extends BaseTypeOrmRepository<AuditEntry> {
  constructor(@InjectRepository(AuditEntry) repository: Repository<AuditEntry>) {
    super(repository, 'audit');
  }
}
