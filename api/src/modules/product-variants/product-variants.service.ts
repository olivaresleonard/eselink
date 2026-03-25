import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { Product } from '../products/product.entity.js';
import { SyncLoggingPolicy } from '../sync-jobs/sync-logging.policy.js';
import { SyncOrchestratorService } from '../sync-jobs/sync-orchestrator.service.js';
import type { CreateProductVariantDto } from './dto/create-product-variant.dto.js';
import { ProductVariant } from './product-variant.entity.js';
import { ProductVariantsRepository } from './product-variants.repository.js';

@Injectable()
export class ProductVariantsService extends BaseDomainService {
  constructor(
    repository: ProductVariantsRepository,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    private readonly syncOrchestratorService: SyncOrchestratorService,
    private readonly syncLoggingPolicy: SyncLoggingPolicy,
  ) {
    super(repository);
  }

  async create(data: Record<string, unknown>) {
    const dto = data as unknown as CreateProductVariantDto;
    const product = await this.productsRepository.findOne({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    return this.variantsRepository.save(
      this.variantsRepository.create({
        workspaceId: product.workspaceId,
        productId: product.id,
        sku: dto.sku,
        title: dto.name,
        price: String(dto.basePrice),
        cost: dto.cost === undefined ? null : String(dto.cost),
        supplierName: dto.supplierName?.trim() || null,
        supplierProductAlias: dto.supplierProductAlias?.trim() || null,
        currency: dto.currency ?? 'CLP',
        isActive: true,
      }),
    );
  }

  findAll() {
    return this.variantsRepository.find({
      relations: { product: true, inventoryItems: true, skuMappings: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const variant = await this.variantsRepository.findOne({
      where: { id },
      relations: { product: true, inventoryItems: true, skuMappings: true, listings: true },
    });

    if (!variant) {
      throw new NotFoundException(`product-variants ${id} not found`);
    }

    return variant;
  }

  async updatePrice(id: string, data: { price: number; reason?: string }) {
    const variant = await this.variantsRepository.findOne({
      where: { id },
    });

    if (!variant) {
      throw new NotFoundException(`product-variants ${id} not found`);
    }

    const previousPrice = Number(variant.price);
    variant.price = String(data.price);
    const savedVariant = await this.variantsRepository.save(variant);

    const jobs = await this.syncOrchestratorService.schedulePriceSyncForVariant({
      workspaceId: variant.workspaceId,
      variantId: variant.id,
      price: data.price,
      reason: data.reason ?? 'manual price update',
    });

    await this.syncLoggingPolicy.logDomainEvent({
      workspaceId: variant.workspaceId,
      action: 'price_updated',
      status: 'queued',
      message: 'Variant price updated and synchronization jobs queued',
      payloadSummary: {
        variantId: variant.id,
        previousPrice,
        newPrice: data.price,
        jobsQueued: jobs.length,
      },
    });

    return {
      variant: savedVariant,
      syncJobsQueued: jobs.length,
    };
  }
}
