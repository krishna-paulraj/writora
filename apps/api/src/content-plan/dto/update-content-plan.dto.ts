import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const CADENCES = ['daily', 'every_3_days', 'weekly', 'biweekly', 'monthly'];

export class UpdateContentPlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  // active | paused | completed
  @IsOptional()
  @IsIn(['active', 'paused', 'completed'])
  status?: string;

  @IsOptional()
  @IsIn(CADENCES)
  cadence?: string;

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  totalTarget?: number | null;
}
