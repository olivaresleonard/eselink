import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class BulkPublishListingDto {
  @IsOptional()
  @IsString()
  workspace_id?: string;

  @IsArray()
  @IsString({ each: true })
  product_variant_ids!: string[];

  @IsArray()
  @IsString({ each: true })
  account_ids!: string[];

  @IsNumber()
  price!: number;

  @IsNumber()
  stock!: number;
}
