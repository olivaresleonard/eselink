import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { Workspace } from './workspace.entity.js';

@Injectable()
export class WorkspacesRepository extends BaseTypeOrmRepository<Workspace> {
  constructor(@InjectRepository(Workspace) repository: Repository<Workspace>) {
    super(repository, 'workspaces');
  }
}
