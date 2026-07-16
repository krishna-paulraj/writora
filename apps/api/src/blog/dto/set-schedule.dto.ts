import { IsISO8601, IsOptional } from 'class-validator';

export class SetScheduleDto {
  // null (or omitted) clears the schedule; class-validator skips @IsOptional
  // fields when they are null/undefined, so only real values must be ISO dates.
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string | null;
}
