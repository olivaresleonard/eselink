import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  productVariantId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  availableStock!: number;

  @IsOptional()
  @IsString()
  locationCode?: string;
}
