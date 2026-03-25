import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ListingStatus } from '../../common/entities/domain.enums.js';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { OperationContextService } from '../../core/operation-context/operation-context.service.js';
import { Account } from '../accounts/account.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { SkuMapping } from '../sku-mappings/sku-mapping.entity.js';
import { SyncOrchestratorService } from '../sync-jobs/sync-orchestrator.service.js';
import { ListingsRepository } from './listings.repository.js';
import { Listing } from './listing.entity.js';
import { ListingPublisherStrategy } from './publishers/listing-publisher.strategy.js';

@Injectable()
export class ListingsService extends BaseDomainService {
  constructor(
    repository: ListingsRepository,
    @InjectRepository(Listing)
    private readonly listingsOrmRepository: Repository<Listing>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
    @InjectRepository(SkuMapping)
    private readonly skuMappingsRepository: Repository<SkuMapping>,
    private readonly operationContextService: OperationContextService,
    private readonly syncOrchestratorService: SyncOrchestratorService,
    private readonly listingPublisherStrategy: ListingPublisherStrategy,
  ) {
    super(repository);
  }

  findAll() {
    return this.listingsOrmRepository.find({
      relations: {
        product: true,
        variant: true,
        account: true,
        channel: true,
      },
      take: 200,
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const listing = await this.listingsOrmRepository.findOne({
      where: { id },
      relations: {
        product: true,
        variant: true,
        account: true,
        channel: true,
        syncLogs: true,
      },
    });

    if (!listing) {
      throw new NotFoundException(`Listing ${id} not found`);
    }

    return listing;
  }

  async publishToAccounts(data: {
    workspaceId?: string;
    productVariantId: string;
    accountIds: string[];
    price: number;
    stock: number;
  }) {
    const workspaceId =
      data.workspaceId ?? (await this.operationContextService.getDefaultWorkspaceId());
    const variant = await this.variantsRepository.findOne({
      where: {
        id: data.productVariantId,
        workspaceId,
      },
      relations: {
        product: true,
      },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant ${data.productVariantId} not found`);
    }

    const accounts = await this.accountsRepository.find({
      where: {
        workspaceId,
        id: In(data.accountIds),
      },
      relations: {
        channel: true,
      },
    });

    const results: Array<Record<string, unknown>> = [];

    for (const account of accounts) {
      let listing = await this.listingsOrmRepository.findOne({
        where: {
          workspaceId,
          accountId: account.id,
          variantId: variant.id,
        },
      });

      if (!listing) {
        listing = this.listingsOrmRepository.create({
          workspaceId,
          productId: variant.productId,
          variantId: variant.id,
          accountId: account.id,
          channelId: account.channelId,
          title: `${variant.product.title} - ${variant.title}`,
          externalSku: variant.sku,
          status: ListingStatus.DRAFT,
          price: String(data.price),
          currency: variant.currency,
          stock: data.stock,
          metadata: {
            publishingMode: 'manual',
          },
        });
      } else {
        listing.title = `${variant.product.title} - ${variant.title}`;
        listing.externalSku = variant.sku;
        listing.price = String(data.price);
        listing.currency = variant.currency;
        listing.stock = data.stock;
      }

      listing = await this.listingsOrmRepository.save(listing);

      let skuMapping = await this.skuMappingsRepository.findOne({
        where: {
          workspaceId,
          accountId: account.id,
          externalSku: variant.sku,
        },
      });

      if (!skuMapping) {
        skuMapping = this.skuMappingsRepository.create({
          workspaceId,
          accountId: account.id,
          externalSku: variant.sku,
        });
      }

      skuMapping.variantId = variant.id;
      skuMapping.listingId = listing.id;
      skuMapping.internalSku = variant.sku;
      skuMapping.isPrimary = true;
      await this.skuMappingsRepository.save(skuMapping);

      const syncJob = await this.syncOrchestratorService.scheduleListingPublish({
        workspaceId,
        accountId: account.id,
        listingId: listing.id,
        productVariantId: variant.id,
        title: listing.title,
        price: data.price,
        stock: data.stock,
        sku: variant.sku,
        currency: listing.currency,
      });

      results.push({
        listingId: listing.id,
        accountId: account.id,
        channelId: account.channelId,
        syncJobId: syncJob.id,
      });
    }

    return {
      publishedTargets: results.length,
      results,
    };
  }

  async bulkPublish(data: {
    workspaceId?: string;
    productVariantIds: string[];
    accountIds: string[];
    price: number;
    stock: number;
  }) {
    const items = [];

    for (const productVariantId of data.productVariantIds) {
      items.push(
        await this.publishToAccounts({
          workspaceId: data.workspaceId,
          productVariantId,
          accountIds: data.accountIds,
          price: data.price,
          stock: data.stock,
        }),
      );
    }

    return {
      totalVariants: data.productVariantIds.length,
      items,
    };
  }

  async importExistingListings(data: { workspaceId?: string; accountId: string }) {
    const workspaceId =
      data.workspaceId ?? (await this.operationContextService.getDefaultWorkspaceId());
    const account = await this.accountsRepository.findOne({
      where: {
        id: data.accountId,
        workspaceId,
      },
      relations: {
        channel: true,
      },
    });

    if (!account) {
      throw new NotFoundException(`Account ${data.accountId} not found`);
    }

    const publisher = this.listingPublisherStrategy.resolve(account.channel.code);
    return publisher.importExistingListings({
      workspaceId,
      accountId: data.accountId,
    });
  }

  async queueInventorySyncByVariant(data: {
    workspaceId: string;
    variantId: string;
    reason?: string;
  }) {
    return this.syncOrchestratorService.scheduleInventorySyncForVariant({
      workspaceId: data.workspaceId,
      variantId: data.variantId,
      reason: data.reason ?? 'variant stock changed',
    });
  }

  async queuePriceSyncByVariant(data: {
    workspaceId: string;
    variantId: string;
    price?: number;
    reason?: string;
  }) {
    return this.syncOrchestratorService.schedulePriceSyncForVariant({
      workspaceId: data.workspaceId,
      variantId: data.variantId,
      price: data.price,
      reason: data.reason ?? 'variant price changed',
    });
  }
}
