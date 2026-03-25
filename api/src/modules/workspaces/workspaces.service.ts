import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { WorkspacesRepository } from './workspaces.repository.js';

@Injectable()
export class WorkspacesService extends BaseDomainService {
  constructor(repository: WorkspacesRepository) {
    super(repository);
  }
}
