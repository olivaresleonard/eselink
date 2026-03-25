import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { AuditService } from './audit.service.js';

@Controller('audit')
export class AuditController extends BaseDomainController {
  constructor(auditService: AuditService) {
    super(auditService);
  }
}

