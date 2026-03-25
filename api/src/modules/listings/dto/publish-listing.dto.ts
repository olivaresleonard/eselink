import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class PublishListingDto {
  @IsOptional()
  @IsString()
  workspace_id?: string;

  @IsString()
  product_variant_id!: string;

  @IsArray()
  @IsString({ each: true })
  account_ids!: string[];

  @IsNumber()
  price!: number;

  @IsNumber()
  stock!: number;
}
