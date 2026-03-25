import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { SyncLogsService } from './sync-logs.service.js';

@Controller('sync-logs')
export class SyncLogsController extends BaseDomainController {
  constructor(syncLogsService: SyncLogsService) {
    super(syncLogsService);
  }
}
