import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateOrderCommentDto {
  @IsOptional()
  @IsString()
  workspace_id?: string;

  @IsString()
  user_id!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsBoolean()
  is_internal?: boolean = true;
}
