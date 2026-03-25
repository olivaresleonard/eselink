import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryMovementType } from '../../common/entities/domain.enums.js';
import { BaseDomainService } from '../../common/services/base-domain.service.js';
import { InventoryMovement } from '../inventory-movements/inventory-movement.entity.js';
import { ProductVariant } from '../product-variants/product-variant.entity.js';
import { SyncLoggingPolicy } from '../sync-jobs/sync-logging.policy.js';
import { SyncOrchestratorService } from '../sync-jobs/sync-orchestrator.service.js';
import type { AdjustInventoryDto } from './dto/adjust-inventory.dto.js';
import type { CreateInventoryItemDto } from './dto/create-inventory-item.dto.js';
import { InventoryRepository } from './inventory.repository.js';
import { InventoryItem } from './inventory-item.entity.js';

@Injectable()
export class InventoryService extends BaseDomainService {
  constructor(
    repository: InventoryRepository,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemsRepository: Repository<InventoryItem>,
    @InjectRepository(InventoryMovement)
    private readonly inventoryMovementsRepository: Repository<InventoryMovement>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    private readonly syncOrchestratorService: SyncOrchestratorService,
    private readonly syncLoggingPolicy: SyncLoggingPolicy,
  ) {
    super(repository);
  }

  async create(data: Record<string, unknown>) {
    const dto = data as unknown as CreateInventoryItemDto;
    const variant = await this.variantsRepository.findOne({
      where: { id: dto.productVariantId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant ${dto.productVariantId} not found`);
    }

    return this.inventoryItemsRepository.save(
      this.inventoryItemsRepository.create({
        workspaceId: variant.workspaceId,
        variantId: variant.id,
        locationCode: dto.locationCode ?? 'default',
        onHand: dto.availableStock,
        available: dto.availableStock,
        reserved: 0,
        incoming: 0,
      }),
    );
  }

  findAll() {
    return this.inventoryItemsRepository.find({
      relations: { variant: { product: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async adjustInventory(data: AdjustInventoryDto) {
    const variant = await this.variantsRepository.findOne({
      where: { id: data.productVariantId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant ${data.productVariantId} not found`);
    }

    const item = await this.inventoryItemsRepository.findOne({
      where: {
        variantId: data.productVariantId,
      },
      order: { createdAt: 'ASC' },
    });

    if (!item) {
      throw new NotFoundException(`Inventory for variant ${data.productVariantId} not found`);
    }

    const nextAvailable = item.available + data.quantity;

    if (nextAvailable < 0) {
      throw new BadRequestException('Inventory cannot be negative');
    }

    const previousAvailable = item.available;
    item.available = nextAvailable;
    item.onHand = Math.max(0, item.onHand + data.quantity);
    const savedItem = await this.inventoryItemsRepository.save(item);

    await this.inventoryMovementsRepository.save(
      this.inventoryMovementsRepository.create({
        workspaceId: item.workspaceId,
        inventoryItemId: item.id,
        type:
          data.reason === 'sync'
            ? InventoryMovementType.SYNC
            : data.reason === 'return'
              ? InventoryMovementType.RETURN
              : InventoryMovementType.ADJUSTMENT,
        quantity: data.quantity,
        previousAvailable,
        newAvailable: nextAvailable,
        referenceType: 'manual_adjustment',
        referenceId: item.id,
        reason: data.reason,
      }),
    );

    await this.syncOrchestratorService.scheduleInventorySyncForVariant({
      workspaceId: item.workspaceId,
      variantId: item.variantId,
      reason: data.reason,
    });

    return savedItem;
  }

  async updateAvailableStock(id: string, data: { available: number; reason?: string }) {
    const item = await this.inventoryItemsRepository.findOne({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException(`inventory ${id} not found`);
    }

    const previousAvailable = item.available;
    if (data.available < 0) {
      throw new BadRequestException('Inventory cannot be negative');
    }

    item.available = data.available;
    item.onHand = Math.max(item.onHand, data.available + item.reserved);
    const savedItem = await this.inventoryItemsRepository.save(item);

    await this.inventoryMovementsRepository.save(
      this.inventoryMovementsRepository.create({
        workspaceId: item.workspaceId,
        inventoryItemId: item.id,
        type: InventoryMovementType.ADJUSTMENT,
        quantity: data.available - previousAvailable,
        previousAvailable,
        newAvailable: data.available,
        referenceType: 'inventory_item',
        referenceId: item.id,
        reason: data.reason ?? 'manual stock update',
      }),
    );

    const jobs = await this.syncOrchestratorService.scheduleInventorySyncForVariant({
      workspaceId: item.workspaceId,
      variantId: item.variantId,
      reason: data.reason ?? 'manual stock update',
    });

    await this.syncLoggingPolicy.logDomainEvent({
      workspaceId: item.workspaceId,
      action: 'inventory_updated',
      status: 'queued',
      message: 'Inventory updated and synchronization jobs queued',
      payloadSummary: {
        inventoryItemId: item.id,
        variantId: item.variantId,
        previousAvailable,
        newAvailable: data.available,
        jobsQueued: jobs.length,
      },
    });

    return {
      item: savedItem,
      syncJobsQueued: jobs.length,
    };
  }
}
