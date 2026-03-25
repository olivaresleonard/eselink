import { IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  internalCategory?: string;

  @IsOptional()
  @IsString()
  variantType?: string;

  @IsOptional()
  @IsString()
  internalImageUrl?: string;

  @IsOptional()
  @IsString()
  internalImageReferenceUrl?: string;

  @IsOptional()
  @IsString()
  internalImageSource?: string;

  @IsOptional()
  @IsString()
  internalImageAiMode?: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;
}
