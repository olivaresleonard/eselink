import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { AuditRepository } from './audit.repository.js';

@Injectable()
export class AuditService extends BaseDomainService {
  constructor(repository: AuditRepository) {
    super(repository);
  }
}
