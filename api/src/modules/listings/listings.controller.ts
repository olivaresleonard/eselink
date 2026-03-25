import { Body, Controller, Post } from '@nestjs/common';
import { BaseDomainController } from '../../common/controllers/base-domain.controller.js';
import { BulkPublishListingDto } from './dto/bulk-publish-listing.dto.js';
import { ImportAccountListingsDto } from './dto/import-account-listings.dto.js';
import { PublishListingDto } from './dto/publish-listing.dto.js';
import { ListingsService } from './listings.service.js';

@Controller('listings')
export class ListingsController extends BaseDomainController {
  constructor(private readonly listingsService: ListingsService) {
    super(listingsService);
  }

  @Post('publish')
  publish(@Body() body: PublishListingDto) {
    return this.listingsService.publishToAccounts({
      workspaceId: body.workspace_id,
      productVariantId: body.product_variant_id,
      accountIds: body.account_ids,
      price: body.price,
      stock: body.stock,
    });
  }

  @Post('bulk-publish')
  bulkPublish(@Body() body: BulkPublishListingDto) {
    return this.listingsService.bulkPublish({
      workspaceId: body.workspace_id,
      productVariantIds: body.product_variant_ids,
      accountIds: body.account_ids,
      price: body.price,
      stock: body.stock,
    });
  }

  @Post('import-existing')
  importExisting(@Body() body: ImportAccountListingsDto) {
    return this.listingsService.importExistingListings({
      workspaceId: body.workspace_id,
      accountId: body.account_id,
    });
  }
}
