import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationsModule } from '../../integrations/integrations.module.js';
import { Account } from '../accounts/account.entity.js';
import { SyncJobsModule } from '../sync-jobs/sync-jobs.module.js';
import { WebhookEvent } from './webhook-event.entity.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksRepository } from './webhooks.repository.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookEvent, Account]), IntegrationsModule, SyncJobsModule],
  providers: [WebhooksRepository, WebhooksService],
  controllers: [WebhooksController],
  exports: [WebhooksService],
})
export class WebhooksModule {}
