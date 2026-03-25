import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PlatformCode } from '../../common/entities/domain.enums.js';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { Account } from '../accounts/account.entity.js';
import { WebhooksRepository } from './webhooks.repository.js';

@Injectable()
export class WebhooksService extends BaseDomainService {
  constructor(
    webhooksRepository: WebhooksRepository,
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
  ) {
    super(webhooksRepository);
  }

  async receiveMercadoLibreWebhook(data: {
    workspaceId: string;
    accountId?: string;
    topic: string;
    externalId?: string;
    payload: Record<string, unknown>;
  }) {
    const resolvedAccountId =
      data.accountId ?? (await this.resolveMercadoLibreAccountId(data.workspaceId, data.payload));

    return this.create({
      workspaceId: data.workspaceId,
      accountId: resolvedAccountId,
      platform: PlatformCode.MERCADOLIBRE,
      topic: data.topic,
      externalId: data.externalId,
      payload: data.payload,
    });
  }

  private async resolveMercadoLibreAccountId(
    workspaceId: string,
    payload: Record<string, unknown>,
  ) {
    const candidateExternalIds = [
      payload.user_id,
      payload.userId,
      payload.owner_id,
      payload.ownerId,
      payload.seller_id,
      payload.sellerId,
    ]
      .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
      .map((value) => String(value));

    if (candidateExternalIds.length === 0) {
      return undefined;
    }

    const account = await this.accountsRepository.findOne({
      where: {
        workspaceId,
        externalId: In(candidateExternalIds),
      },
    });

    return account?.id;
  }
}
