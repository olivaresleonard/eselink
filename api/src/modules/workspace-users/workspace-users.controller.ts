import { Controller } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { WorkspaceUsersService } from './workspace-users.service.js';

@Controller('workspace-users')
export class WorkspaceUsersController extends BaseDomainController {
  constructor(workspaceUsersService: WorkspaceUsersService) {
    super(workspaceUsersService);
  }
}

