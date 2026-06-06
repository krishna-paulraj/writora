import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePlanItemDto {
  // ISO date to move a planned article to; null parks it (never auto-dispatched).
  @IsOptional()
  @IsString()
  scheduledFor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;
}
