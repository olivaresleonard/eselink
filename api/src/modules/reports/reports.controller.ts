import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { ReportsService } from './reports.service.js';

@Controller('reports')
export class ReportsController extends BaseDomainController {
  constructor(reportsService: ReportsService) {
    super(reportsService);
  }
}

