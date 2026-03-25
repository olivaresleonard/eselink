import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { Account } from '../accounts/account.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import type { CreateSkuMappingDto } from './dto/create-sku-mapping.dto.js';
import { SkuMapping } from './sku-mapping.entity.js';
import { SkuMappingsRepository } from './sku-mappings.repository.js';

@Injectable()
export class SkuMappingsService extends BaseDomainService {
  constructor(
    repository: SkuMappingsRepository,
    @InjectRepository(SkuMapping)
    private readonly skuMappingsOrmRepository: Repository<SkuMapping>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(Account)
    private readonly accountsRepository: Repository<Account>,
  ) {
    super(repository);
  }

  async create(data: Record<string, unknown>) {
    const dto = data as unknown as CreateSkuMappingDto;
    const variant = await this.variantsRepository.findOne({
      where: { id: dto.productVariantId },
    });
    const account = await this.accountsRepository.findOne({
      where: { id: dto.accountId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant ${dto.productVariantId} not found`);
    }

    if (!account) {
      throw new NotFoundException(`Account ${dto.accountId} not found`);
    }

    const existing = await this.skuMappingsOrmRepository.findOne({
      where: {
        workspaceId: variant.workspaceId,
        accountId: dto.accountId,
        externalSku: dto.externalSku,
      },
    });

    const mapping =
      existing ??
      this.skuMappingsOrmRepository.create({
        workspaceId: variant.workspaceId,
        accountId: dto.accountId,
        externalSku: dto.externalSku,
      });

    mapping.variantId = variant.id;
    mapping.internalSku = variant.sku;
    mapping.isPrimary = true;

    return this.skuMappingsOrmRepository.save(mapping);
  }

  findAll() {
    return this.skuMappingsOrmRepository.find({
      relations: { variant: true, account: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findByExternalSku(externalSku: string) {
    const mapping = await this.skuMappingsOrmRepository.findOne({
      where: { externalSku },
      relations: { variant: { product: true }, account: true },
    });

    if (!mapping) {
      throw new NotFoundException(`SKU mapping for ${externalSku} not found`);
    }

    return mapping.variant;
  }
}
