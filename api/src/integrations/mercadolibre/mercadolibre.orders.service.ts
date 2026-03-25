import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../modules/accounts/account.entity.js';
import type { NormalizedOrder } from '../channel-integration.interface.js';
import { MercadoLibreClient } from './mercadolibre.client.js';
import { MercadoLibreMapper } from './mercadolibre.mapper.js';

@Injectable()
export class MercadoLibreOrdersService {
  private static readonly SYNC_OVERLAP_MS = 10 * 60 * 1000;

  constructor(
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    private readonly mercadoLibreClient: MercadoLibreClient,
    private readonly mercadoLibreMapper: MercadoLibreMapper,
  ) {}

  async fetchPaidOrders(
    accountId: string,
    options?: { limit?: number; since?: Date | null },
  ): Promise<NormalizedOrder[]> {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
      relations: { channel: true },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const searchResponse = await this.mercadoLibreClient.searchPaidOrders(
      account,
      options?.limit ?? 50,
    );
    const normalizedOrders: NormalizedOrder[] = [];
    const cutoffDate = options?.since
      ? new Date(options.since.getTime() - MercadoLibreOrdersService.SYNC_OVERLAP_MS)
      : null;

    for (const orderSummary of searchResponse.results) {
      const summaryCreatedAt = this.extractSummaryCreatedAt(orderSummary);

      if (cutoffDate && summaryCreatedAt && summaryCreatedAt < cutoffDate) {
        break;
      }

      const externalOrderId =
        typeof orderSummary.id === 'string' || typeof orderSummary.id === 'number'
          ? String(orderSummary.id)
          : null;

      if (!externalOrderId) {
        continue;
      }

      const orderDetail = await this.mercadoLibreClient.getOrderDetail(account, externalOrderId);
      normalizedOrders.push(this.mercadoLibreMapper.mapOrder(orderDetail as never));
    }

    return normalizedOrders;
  }

  private extractSummaryCreatedAt(orderSummary: Record<string, unknown>) {
    const createdAt = orderSummary.date_created;

    if (typeof createdAt !== 'string') {
      return null;
    }

    const parsedDate = new Date(createdAt);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  async fetchOrderById(
    accountId: string,
    externalOrderId: string | number,
  ): Promise<NormalizedOrder | null> {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
      relations: { channel: true },
    });

    if (!account) {
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const orderDetail = await this.mercadoLibreClient.getOrderDetail(account, externalOrderId);
    const normalizedOrder = this.mercadoLibreMapper.mapOrder(orderDetail as never);

    return normalizedOrder.externalOrderId ? normalizedOrder : null;
  }
}
