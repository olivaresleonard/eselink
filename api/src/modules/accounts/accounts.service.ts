import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OperationContextService } from '../../core/operation-context/operation-context.service.js';
import { MercadoLibreService } from '../../integrations/mercadolibre/mercadolibre.service.js';
import { Channel } from '../channels/channel.entity.js';
import { SyncOrchestratorService } from '../sync-jobs/sync-orchestrator.service.js';
import type { ConnectAccountDto } from './dto/connect-account.dto.js';
import type { CreateAccountDto } from './dto/create-account.dto.js';
import { Account } from './account.entity.js';
import { AccountsRepository } from './accounts.repository.js';

@Injectable()
export class AccountsService extends BaseDomainService {
  constructor(
    repository: AccountsRepository,
    @InjectRepository(Account)
    private readonly accountsOrmRepository: Repository<Account>,
    @InjectRepository(Channel)
    private readonly channelsRepository: Repository<Channel>,
    private readonly operationContextService: OperationContextService,
    private readonly mercadoLibreService: MercadoLibreService,
    private readonly syncOrchestratorService: SyncOrchestratorService,
  ) {
    super(repository);
  }

  async create(data: Record<string, unknown>) {
    const dto = data as unknown as CreateAccountDto;
    const workspaceId =
      dto.workspaceId ?? (await this.operationContextService.getDefaultWorkspaceId());
    const channel = await this.channelsRepository.findOne({
      where: { id: dto.channelId },
    });

    if (!channel) {
      throw new NotFoundException(`Channel ${dto.channelId} not found`);
    }

    const account = this.accountsOrmRepository.create({
      name: dto.name,
      channelId: dto.channelId,
      workspaceId,
      externalId: dto.externalId ?? `${channel.code}-${Date.now()}`,
      accessToken: dto.accessToken ?? null,
      refreshToken: dto.refreshToken ?? null,
      status: dto.status,
      currency: dto.currency ?? 'CLP',
    });

    return this.accountsOrmRepository.save(account);
  }

  async connectAccount(data: ConnectAccountDto) {
    return this.create({
      name: data.name,
      channelId: data.channelId,
      externalId: data.externalAccountId,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      status: data.status,
      currency: data.currency,
    });
  }

  findAll() {
    return this.accountsOrmRepository.find({
      relations: { channel: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const account = await this.accountsOrmRepository.findOne({
      where: { id },
      relations: { channel: true },
    });

    if (!account) {
      throw new NotFoundException(`accounts ${id} not found`);
    }

    return account;
  }

  async importMercadoLibreListings(accountId: string) {
    const account = await this.findOne(accountId);
    return this.mercadoLibreService.importListings({
      accountId,
      workspaceId: account.workspaceId,
    });
  }

  async importMercadoLibreOrders(accountId: string) {
    const account = await this.findOne(accountId);
    return this.syncOrchestratorService.scheduleOrdersImport({
      workspaceId: account.workspaceId,
      accountId,
      reason: 'manual Mercado Libre orders import',
    });
  }

  async syncMercadoLibreStock(data: {
    accountId: string;
    entityId: string;
    variantIds?: string[];
    listingIds?: string[];
  }) {
    const account = await this.findOne(data.accountId);
    return this.syncOrchestratorService.scheduleInventorySync({
      workspaceId: account.workspaceId,
      accountId: data.accountId,
      entityId: data.entityId,
      variantIds: data.variantIds,
      listingIds: data.listingIds,
      reason: 'manual Mercado Libre inventory sync',
    });
  }

  async syncMercadoLibrePrice(data: {
    accountId: string;
    entityId: string;
    price?: number;
  }) {
    const account = await this.findOne(data.accountId);
    return this.syncOrchestratorService.schedulePriceSync({
      workspaceId: account.workspaceId,
      accountId: data.accountId,
      entityId: data.entityId,
      price: data.price,
      reason: 'manual Mercado Libre price sync',
    });
  }
}
