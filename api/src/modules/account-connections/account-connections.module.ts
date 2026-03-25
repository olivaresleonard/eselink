import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsModule } from '../../integrations/integrations.module.js';
import { AccountConnection } from './account-connection.entity.js';
import { AccountConnectionsController } from './account-connections.controller.js';
import { AccountConnectionsRepository } from './account-connections.repository.js';
import { AccountConnectionsService } from './account-connections.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([AccountConnection]), IntegrationsModule],
  controllers: [AccountConnectionsController],
  providers: [AccountConnectionsRepository, AccountConnectionsService],
  exports: [AccountConnectionsService],
})
export class AccountConnectionsModule {}
