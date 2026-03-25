import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from './workspace.entity.js';
import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesRepository } from './workspaces.repository.js';
import { WorkspacesService } from './workspaces.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Workspace])],
  controllers: [WorkspacesController],
  providers: [WorkspacesRepository, WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
