import { IsOptional, IsString } from 'class-validator';

export class ImportAccountListingsDto {
  @IsOptional()
  @IsString()
  workspace_id?: string;

  @IsString()
  account_id!: string;
}
