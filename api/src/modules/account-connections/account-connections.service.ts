import { Injectable } from '@nestjs/common';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OperationContextService } from '../../core/operation-context/operation-context.service.js';
import { MercadoLibreAuthService } from '../../integrations/mercadolibre/mercadolibre-auth.service.js';
import { MercadoLibreService } from '../../integrations/mercadolibre/mercadolibre.service.js';
import { AccountConnectionsRepository } from './account-connections.repository.js';

@Injectable()
export class AccountConnectionsService extends BaseDomainService {
  constructor(
    repository: AccountConnectionsRepository,
    private readonly operationContextService: OperationContextService,
    private readonly mercadoLibreAuthService: MercadoLibreAuthService,
    private readonly mercadoLibreService: MercadoLibreService,
  ) {
    super(repository);
  }

  async startMercadoLibreOAuth(data: {
    workspaceId?: string;
    redirectUri?: string;
    state?: string;
  } = {}) {
    const workspaceId =
      data.workspaceId ??
      this.resolveWorkspaceIdFromState(data.state) ??
      (await this.operationContextService.getDefaultWorkspaceId());

    return this.mercadoLibreAuthService.getAuthorizationUrl({
      ...data,
      workspaceId,
    });
  }

  async connectMercadoLibreAccount(data: {
    workspaceId?: string;
    code: string;
    redirectUri?: string;
    channelId?: string;
    accountName?: string;
    state?: string;
  }) {
    const workspaceId =
      data.workspaceId ??
      this.resolveWorkspaceIdFromState(data.state) ??
      (await this.operationContextService.getDefaultWorkspaceId());

    const result = await this.mercadoLibreAuthService.connectAccount({
      workspaceId,
      code: data.code,
      redirectUri: data.redirectUri,
      channelId: data.channelId,
      accountName: data.accountName,
    });

    await this.mercadoLibreService.importListings({
      accountId: result.account.id,
      workspaceId,
    });

    return result;
  }

  private resolveWorkspaceIdFromState(state?: string) {
    if (!state) {
      return undefined;
    }

    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      return typeof decoded.workspaceId === 'string' ? decoded.workspaceId : undefined;
    } catch {
      return undefined;
    }
  }
}
