import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { ReportsRepository } from './reports.repository.js';

@Injectable()
export class ReportsService extends BaseDomainService {
  constructor(repository: ReportsRepository) {
    super(repository);
  }
}
