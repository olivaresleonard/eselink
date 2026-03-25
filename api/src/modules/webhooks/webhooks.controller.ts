import { Body, Controller, Post } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { SyncOrchestratorService } from '../sync-jobs/sync-orchestrator.service.js';
import { WebhooksService } from './webhooks.service.js';

@Controller('webhooks')
export class WebhooksController extends BaseDomainController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly syncOrchestratorService: SyncOrchestratorService,
  ) {
    super(webhooksService);
  }

  @Post('mercadolibre')
  async receiveMercadoLibreWebhook(
    @Body()
    body: {
      workspaceId: string;
      accountId?: string;
      topic: string;
      externalId?: string;
      payload: Record<string, unknown>;
    },
  ) {
    const event = await this.webhooksService.receiveMercadoLibreWebhook(body);

    await this.syncOrchestratorService.scheduleWebhookProcessing({
      workspaceId: body.workspaceId,
      accountId: body.accountId,
      webhookEventId: event.id,
      reason: `webhook ${body.topic} received`,
    });

    return {
      received: true,
      eventId: event.id,
    };
  }
}
