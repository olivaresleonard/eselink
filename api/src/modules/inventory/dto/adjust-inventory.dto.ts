import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class AdjustInventoryDto {
  @IsString()
  productVariantId!: string;

  @Type(() => Number)
  @IsNumber()
  quantity!: number;

  @IsString()
  reason!: string;
}
