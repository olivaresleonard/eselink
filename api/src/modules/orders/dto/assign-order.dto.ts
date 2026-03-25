import { IsOptional, IsString } from 'class-validator';

export class AssignOrderDto {
  @IsOptional()
  @IsString()
  workspace_id?: string;

  @IsString()
  user_id!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
