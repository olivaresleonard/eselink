import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateSyncJobDto {
  @IsString()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsString()
  type!: string;

  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  attempts?: number;
}

