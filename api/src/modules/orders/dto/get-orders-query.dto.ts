import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { PlatformCode } from '../../../common/entities/domain.enums.js';

export class GetOrdersQueryDto {
  @IsOptional()
  @IsString()
  workspace_id?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsEnum(PlatformCode)
  platform?: PlatformCode;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyPending?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyShippingToday?: boolean = false;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  onlyRecent48Hours?: boolean = false;

  @IsOptional()
  @IsString()
  shippingDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  workspaceId?: string;
}
