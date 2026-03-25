import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PlatformCode } from '../../../common/entities/domain.enums.js';

export class CreateChannelDto {
  @IsString()
  name!: string;

  @IsEnum(PlatformCode)
  code!: PlatformCode;

  @IsOptional()
  @IsString()
  workspaceId?: string;
}
