import { Injectable } from '@nestjs/common';
import { Account } from '../../modules/accounts/account.entity.js';
import { MercadoLibreApiClient } from './mercadolibre-api.client.js';
import { MercadoLibreAuthService } from './mercadolibre-auth.service.js';

type MercadoLibreOrdersSearchResponse = {
  results: Array<Record<string, unknown>>;
};

@Injectable()
export class MercadoLibreClient {
  constructor(
    private readonly apiClient: MercadoLibreApiClient,
    private readonly authService: MercadoLibreAuthService,
  ) {}

  async searchPaidOrders(account: Account, limit = 50) {
    const accessToken = await this.authService.ensureAccessToken(account.id);

    return this.apiClient.request<MercadoLibreOrdersSearchResponse>('/orders/search', {
      method: 'GET',
      accessToken,
      query: {
        seller: account.externalId,
        'order.status': 'paid',
        sort: 'date_desc',
        limit,
      },
    });
  }

  async getOrderDetail(account: Account, externalOrderId: string | number) {
    const accessToken = await this.authService.ensureAccessToken(account.id);

    return this.apiClient.request<Record<string, unknown>>(`/orders/${externalOrderId}`, {
      method: 'GET',
      accessToken,
    });
  }
}
