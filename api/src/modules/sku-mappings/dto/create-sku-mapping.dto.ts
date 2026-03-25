import { IsString } from 'class-validator';

export class CreateSkuMappingDto {
  @IsString()
  productVariantId!: string;

  @IsString()
  accountId!: string;

  @IsString()
  externalSku!: string;
}
