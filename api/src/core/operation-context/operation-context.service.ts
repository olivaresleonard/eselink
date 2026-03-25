import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../../modules/workspaces/workspace.entity.js';

@Injectable()
export class OperationContextService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
  ) {}

  async getDefaultWorkspace(): Promise<Workspace> {
    const existing = await this.workspacesRepository.findOne({
      where: {},
      order: { createdAt: 'ASC' },
    });

    if (existing) {
      return existing;
    }

    const workspace = this.workspacesRepository.create({
      name: 'Operacion principal',
      slug: 'operacion-principal',
      status: 'active',
      timezone: 'America/Santiago',
      currency: 'CLP',
    });

    return this.workspacesRepository.save(workspace);
  }

  async getDefaultWorkspaceId(): Promise<string> {
    const workspace = await this.getDefaultWorkspace();
    return workspace.id;
  }
}
