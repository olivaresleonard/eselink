import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsModule } from '../../integrations/integrations.module.js';
import { Channel } from '../channels/channel.entity.js';
import { SyncJobsModule } from '../sync-jobs/sync-jobs.module.js';
import { Account } from './account.entity.js';
import { AccountsController } from './accounts.controller.js';
import { AccountsRepository } from './accounts.repository.js';
import { AccountsService } from './accounts.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Account, Channel]), IntegrationsModule, SyncJobsModule],
  controllers: [AccountsController],
  providers: [AccountsRepository, AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
