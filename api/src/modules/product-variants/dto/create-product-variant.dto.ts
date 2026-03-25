import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateProductVariantDto {
  @IsString()
  productId!: string;

  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  basePrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cost?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsString()
  supplierProductAlias?: string;
}
