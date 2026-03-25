import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { WorkspaceUsersRepository } from './workspace-users.repository.js';

@Injectable()
export class WorkspaceUsersService extends BaseDomainService {
  constructor(repository: WorkspaceUsersRepository) {
    super(repository);
  }
}
