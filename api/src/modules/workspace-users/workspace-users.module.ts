import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceUser } from './workspace-user.entity.js';
import { WorkspaceUsersController } from './workspace-users.controller.js';
import { WorkspaceUsersRepository } from './workspace-users.repository.js';
import { WorkspaceUsersService } from './workspace-users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceUser])],
  controllers: [WorkspaceUsersController],
  providers: [WorkspaceUsersRepository, WorkspaceUsersService],
  exports: [WorkspaceUsersService],
})
export class WorkspaceUsersModule {}
