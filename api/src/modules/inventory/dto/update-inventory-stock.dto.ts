import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateInventoryStockDto {
  @IsInt()
  available!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
