import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { SyncJobsService } from './sync-jobs.service.js';

@Controller('sync-jobs')
export class SyncJobsController extends BaseDomainController {
  constructor(syncJobsService: SyncJobsService) {
    super(syncJobsService);
  }
}
