import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto.js';
import { UpdateInventoryStockDto } from './dto/update-inventory-stock.dto.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
export class InventoryController extends BaseDomainController {
  constructor(private readonly inventoryService: InventoryService) {
    super(inventoryService);
  }

  @Patch(':id/stock')
  updateStock(@Param('id') id: string, @Body() dto: UpdateInventoryStockDto) {
    return this.inventoryService.updateAvailableStock(id, dto);
  }

  @Post('adjust')
  adjustInventory(@Body() dto: AdjustInventoryDto) {
    return this.inventoryService.adjustInventory(dto);
  }
}
