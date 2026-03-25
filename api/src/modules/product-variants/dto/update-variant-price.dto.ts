import { IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateVariantPriceDto {
  @IsNumber()
  price!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
