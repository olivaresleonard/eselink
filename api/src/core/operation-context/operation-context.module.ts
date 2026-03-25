import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from '../../modules/workspaces/workspace.entity.js';
import { OperationContextService } from './operation-context.service.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Workspace])],
  providers: [OperationContextService],
  exports: [OperationContextService],
})
export class OperationContextModule {}
