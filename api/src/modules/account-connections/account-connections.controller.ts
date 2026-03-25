import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { AccountConnectionsService } from './account-connections.service.js';

@Controller('account-connections')
export class AccountConnectionsController extends BaseDomainController {
  constructor(private readonly accountConnectionsService: AccountConnectionsService) {
    super(accountConnectionsService);
  }

  @Post('mercadolibre/oauth/start')
  startMercadoLibreOAuth(
    @Body()
    body?: {
      workspaceId?: string;
      redirectUri?: string;
      state?: string;
    },
  ) {
    return this.accountConnectionsService.startMercadoLibreOAuth(body ?? {});
  }

  @Post('mercadolibre/oauth/callback')
  connectMercadoLibreAccount(
    @Body()
    body: {
      workspaceId?: string;
      code: string;
      redirectUri?: string;
      channelId?: string;
      accountName?: string;
      state?: string;
    },
  ) {
    return this.accountConnectionsService.connectMercadoLibreAccount(body);
  }

  @Get('mercadolibre/oauth/callback')
  connectMercadoLibreAccountFromQuery(
    @Query('code') code: string,
    @Query('workspaceId') workspaceId?: string,
    @Query('state') state?: string,
    @Query('redirectUri') redirectUri?: string,
    @Query('channelId') channelId?: string,
    @Query('accountName') accountName?: string,
    @Res() response?: Response,
  ) {
    const frontendBaseUrl = this.resolveFrontendBaseUrl();

    return this.accountConnectionsService
      .connectMercadoLibreAccount({
        workspaceId,
        code,
        state,
        redirectUri,
        channelId,
        accountName,
      })
      .then((result) => {
        if (!response) {
          return result;
        }

        const successUrl = new URL('/integrations', frontendBaseUrl);
        successUrl.searchParams.set('oauth', 'success');
        successUrl.searchParams.set('provider', 'mercadolibre');
        successUrl.searchParams.set('account', result.account.name);

        return response.redirect(successUrl.toString());
      })
      .catch((error: unknown) => {
        if (!response) {
          throw error;
        }

        const failureUrl = new URL('/integrations', frontendBaseUrl);
        failureUrl.searchParams.set('oauth', 'error');
        failureUrl.searchParams.set('provider', 'mercadolibre');
        failureUrl.searchParams.set(
          'message',
          error instanceof Error ? error.message : 'No pudimos completar la conexión.',
        );

        return response.redirect(failureUrl.toString());
      });
  }

  private resolveFrontendBaseUrl() {
    const explicitUrl =
      process.env.WEB_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_URL ??
      process.env.FRONTEND_URL;

    if (explicitUrl) {
      return explicitUrl;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    return apiUrl.replace(/\/api\/?$/, '').replace(':4000', ':3000');
  }
}
