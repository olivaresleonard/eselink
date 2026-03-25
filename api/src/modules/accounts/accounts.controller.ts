import { Body, Controller, Param, Post } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { ConnectAccountDto } from './dto/connect-account.dto.js';
import { AccountsService } from './accounts.service.js';

@Controller('accounts')
export class AccountsController extends BaseDomainController {
  constructor(private readonly accountsService: AccountsService) {
    super(accountsService);
  }

  @Post('connect')
  connect(@Body() body: ConnectAccountDto) {
    return this.accountsService.connectAccount(body);
  }

  @Post(':id/mercadolibre/import-listings')
  importMercadoLibreListings(@Param('id') id: string) {
    return this.accountsService.importMercadoLibreListings(id);
  }

  @Post(':id/mercadolibre/import-orders')
  importMercadoLibreOrders(@Param('id') id: string) {
    return this.accountsService.importMercadoLibreOrders(id);
  }

  @Post(':id/mercadolibre/sync-stock')
  syncMercadoLibreStock(
    @Param('id') id: string,
    @Body()
    body: {
      entityId: string;
      variantIds?: string[];
      listingIds?: string[];
    },
  ) {
    return this.accountsService.syncMercadoLibreStock({
      accountId: id,
      entityId: body.entityId,
      variantIds: body.variantIds,
      listingIds: body.listingIds,
    });
  }

  @Post(':id/mercadolibre/sync-price')
  syncMercadoLibrePrice(
    @Param('id') id: string,
    @Body()
    body: {
      entityId: string;
      price?: number;
    },
  ) {
    return this.accountsService.syncMercadoLibrePrice({
      accountId: id,
      entityId: body.entityId,
      price: body.price,
    });
  }
}
