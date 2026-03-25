import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AccountStatus } from '../../../common/entities/domain.enums.js';

export class CreateAccountDto {
  @IsString()
  name!: string;

  @IsString()
  channelId!: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  externalId?: string;

  @IsOptional()
  @IsString()
  accessToken?: string;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsEnum(AccountStatus)
  status!: AccountStatus;

  @IsOptional()
  @IsString()
  currency?: string;
}
