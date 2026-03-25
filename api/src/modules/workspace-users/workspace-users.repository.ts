import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseTypeOrmRepository } from '../../common/repositories/base-typeorm.repository.js';
import { WorkspaceUser } from './workspace-user.entity.js';

@Injectable()
export class WorkspaceUsersRepository extends BaseTypeOrmRepository<WorkspaceUser> {
  constructor(@InjectRepository(WorkspaceUser) repository: Repository<WorkspaceUser>) {
    super(repository, 'workspace-users');
  }
}
