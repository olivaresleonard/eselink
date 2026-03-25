import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller('workspaces')
export class WorkspacesController extends BaseDomainController {
  constructor(workspacesService: WorkspacesService) {
    super(workspacesService);
  }
}

