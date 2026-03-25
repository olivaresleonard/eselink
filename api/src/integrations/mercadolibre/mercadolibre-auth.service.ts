import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConnectionStatus, PlatformCode } from '../../common/entities/domain.enums.js';
import { AccountConnection } from '../../modules/account-connections/account-connection.entity.js';
import { Account } from '../../modules/accounts/account.entity.js';
import { Channel } from '../../modules/channels/channel.entity.js';
import { MercadoLibreApiClient } from './mercadolibre-api.client.js';

type MercadoLibreTokenResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id?: number;
};

type MercadoLibreUser = {
  id: number;
  nickname: string;
  site_id?: string;
  country_id?: string;
};

@Injectable()
export class MercadoLibreAuthService {
  private readonly logger = new Logger(MercadoLibreAuthService.name);
  private readonly clientId = process.env.MELI_CLIENT_ID ?? '';
  private readonly clientSecret = process.env.MELI_CLIENT_SECRET ?? '';
  private readonly redirectUri = process.env.MELI_REDIRECT_URI ?? '';
  private readonly authBaseUrl =
    process.env.MELI_AUTH_BASE_URL ?? 'https://auth.mercadolibre.com';

  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(AccountConnection)
    private readonly connectionsRepository: Repository<AccountConnection>,
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
    private readonly apiClient: MercadoLibreApiClient,
  ) {}

  getAuthorizationUrl(input: {
    workspaceId: string;
    redirectUri?: string;
    state?: string;
  }) {
    const redirectUri = input.redirectUri ?? this.redirectUri;

    if (!this.clientId || !redirectUri) {
      throw new BadRequestException('Mercado Libre OAuth is not configured');
    }

    const state =
      input.state ??
      Buffer.from(
        JSON.stringify({
          workspaceId: input.workspaceId,
          ts: Date.now(),
        }),
      ).toString('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
    });

    return {
      url: `${this.authBaseUrl}/authorization?${params.toString()}`,
      state,
    };
  }

  async connectAccount(input: {
    workspaceId: string;
    code: string;
    redirectUri?: string;
    accountName?: string;
    channelId?: string;
  }) {
    const redirectUri = input.redirectUri ?? this.redirectUri;
    if (!redirectUri) {
      throw new BadRequestException('Mercado Libre redirect URI is required');
    }

    const token = await this.exchangeCodeForToken(input.code, redirectUri);
    this.validateTokenPayload(token);
    return this.persistConnectionFromToken({
      workspaceId: input.workspaceId,
      token,
      accountName: input.accountName,
      channelId: input.channelId,
    });
  }

  private async persistConnectionFromToken(input: {
    workspaceId: string;
    token: MercadoLibreTokenResponse;
    accountName?: string;
    channelId?: string;
  }) {
    const token = input.token;
    const me = await this.getCurrentUser(token.access_token);
    const channel = await this.resolveChannel(input.workspaceId, me, input.channelId);

    let account = await this.accountsRepository.findOne({
      where: {
        workspaceId: input.workspaceId,
        channelId: channel.id,
        externalId: String(me.id),
      },
    });

    if (!account) {
      account = this.accountsRepository.create({
        workspaceId: input.workspaceId,
        channelId: channel.id,
        name: input.accountName ?? me.nickname,
        externalId: String(me.id),
        externalName: me.nickname,
        status: 'active' as never,
        currency: 'CLP',
        countryCode: me.site_id ?? me.country_id ?? channel.countryCode,
        settings: {
          provider: PlatformCode.MERCADOLIBRE,
          nickname: me.nickname,
          siteId: me.site_id,
        },
      });
    } else {
      account.name = input.accountName ?? me.nickname;
      account.externalName = me.nickname;
      account.countryCode = me.site_id ?? me.country_id ?? account.countryCode;
      account.status = 'active' as never;
      account.lastSyncAt = new Date();
    }

    account = await this.accountsRepository.save(account);

    let connection = await this.connectionsRepository.findOne({
      where: {
        workspaceId: input.workspaceId,
        accountId: account.id,
      },
    });

    if (!connection) {
      connection = this.connectionsRepository.create({
        workspaceId: input.workspaceId,
        accountId: account.id,
      });
    }

    connection.status = ConnectionStatus.CONNECTED;
    connection.authType = 'oauth';
    connection.accessToken = token.access_token;
    connection.refreshToken = token.refresh_token;
    connection.tokenType = token.token_type;
    connection.scopes = token.scope?.split(' ') ?? [];
    connection.expiresAt = new Date(Date.now() + token.expires_in * 1000);
    connection.lastValidatedAt = new Date();
    connection.metadata = {
      userId: token.user_id ?? me.id,
      nickname: me.nickname,
      siteId: me.site_id,
      lastTokenRefreshAt: new Date().toISOString(),
    };

    connection = await this.connectionsRepository.save(connection);

    return {
      account,
      connection,
      profile: me,
    };
  }

  async ensureAccessToken(accountId: string) {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
      relations: {
        connections: true,
      },
    });

    const connection = account?.connections?.[0];
    if (!account || !connection?.accessToken) {
      throw new UnauthorizedException('Mercado Libre account is not connected');
    }

    if (!connection.refreshToken) {
      this.logger.warn(
        `Mercado Libre connection ${connection.id} for account ${accountId} has no refresh token`,
      );
    }

    if (!connection.expiresAt && connection.refreshToken) {
      this.logger.warn(
        `Mercado Libre connection ${connection.id} for account ${accountId} has no expiresAt, attempting refresh`,
      );
      return this.refreshAccessToken(connection.id, connection.refreshToken);
    }

    if (
      connection.expiresAt &&
      connection.refreshToken &&
      connection.expiresAt.getTime() - Date.now() < 60_000
    ) {
      this.logger.log(
        `Refreshing Mercado Libre access token for account ${accountId} before expiration`,
      );
      return this.refreshAccessToken(connection.id, connection.refreshToken);
    }

    if (connection.expiresAt && connection.expiresAt.getTime() <= Date.now()) {
      connection.status = connection.refreshToken
        ? ConnectionStatus.ERROR
        : ConnectionStatus.EXPIRED;
      connection.lastValidatedAt = new Date();
      await this.connectionsRepository.save(connection);
      throw new UnauthorizedException(
        connection.refreshToken
          ? 'Mercado Libre access token could not be refreshed'
          : 'Mercado Libre connection expired and requires reconnection',
      );
    }

    return connection.accessToken;
  }

  private async exchangeCodeForToken(code: string, redirectUri: string) {
    if (!this.clientId || !this.clientSecret) {
      throw new BadRequestException('Mercado Libre OAuth credentials are missing');
    }

    return this.apiClient.request<MercadoLibreTokenResponse>('/oauth/token', {
      method: 'POST',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
      contentType: 'form',
    });
  }

  async refreshAccessToken(connectionId: string, refreshToken: string) {
    const connection = await this.connectionsRepository.findOneByOrFail({ id: connectionId });

    try {
      const token = await this.apiClient.request<MercadoLibreTokenResponse>('/oauth/token', {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
        }),
        contentType: 'form',
      });

      this.validateTokenPayload(token);

      connection.accessToken = token.access_token;
      connection.refreshToken = token.refresh_token;
      connection.tokenType = token.token_type;
      connection.expiresAt = new Date(Date.now() + token.expires_in * 1000);
      connection.status = ConnectionStatus.CONNECTED;
      connection.lastValidatedAt = new Date();
      connection.metadata = {
        ...(connection.metadata ?? {}),
        userId: token.user_id ?? connection.metadata?.userId,
        lastTokenRefreshAt: new Date().toISOString(),
      };
      await this.connectionsRepository.save(connection);

      this.logger.log(`Mercado Libre token refreshed for connection ${connectionId}`);

      return token.access_token;
    } catch (error) {
      connection.status = ConnectionStatus.ERROR;
      connection.lastValidatedAt = new Date();
      connection.metadata = {
        ...(connection.metadata ?? {}),
        lastRefreshErrorAt: new Date().toISOString(),
      };
      await this.connectionsRepository.save(connection);

      this.logger.error(`Failed to refresh Mercado Libre token for connection ${connectionId}`);
      throw error;
    }
  }

  private getCurrentUser(accessToken: string) {
    return this.apiClient.request<MercadoLibreUser>('/users/me', {
      method: 'GET',
      accessToken,
    });
  }

  private async resolveChannel(
    workspaceId: string,
    profile: MercadoLibreUser,
    channelId?: string,
  ) {
    if (channelId) {
      const existing = await this.channelsRepository.findOneBy({ id: channelId });
      if (!existing) {
        throw new BadRequestException(`Channel ${channelId} not found`);
      }
      return existing;
    }

    const countryCode = profile.site_id ?? profile.country_id ?? 'MLA';
    let channel = await this.channelsRepository.findOne({
      where: {
        workspaceId,
        code: PlatformCode.MERCADOLIBRE,
        countryCode,
      },
    });

    if (!channel) {
      channel = this.channelsRepository.create({
        workspaceId,
        code: PlatformCode.MERCADOLIBRE,
        name: `Mercado Libre ${countryCode}`,
        countryCode,
        isEnabled: true,
      });
      channel = await this.channelsRepository.save(channel);
    }

    return channel;
  }

  private validateTokenPayload(token: MercadoLibreTokenResponse) {
    if (!token.access_token || !token.refresh_token || !token.expires_in) {
      throw new UnauthorizedException(
        'Mercado Libre OAuth response is incomplete and cannot be persisted safely',
      );
    }
  }
}
