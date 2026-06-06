import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { ArticleLength, Tone } from '../../ai/ai.service';

const TONES = ['professional', 'casual', 'friendly', 'witty', 'confident'];
const LENGTHS = ['short', 'medium', 'long'];
const CADENCES = ['daily', 'every_3_days', 'weekly', 'biweekly', 'monthly'];

export class PlanItemInput {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetKeyword?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  keywords?: string[];

  // Optional ISO date the planner can set; defaults to the next cadence slot.
  @IsOptional()
  @IsString()
  scheduledFor?: string;
}

export class CreateContentPlanDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  @MaxLength(300)
  topic: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  audience?: string;

  @IsOptional()
  @IsIn(TONES)
  tone?: Tone;

  @IsOptional()
  @IsIn(LENGTHS)
  length?: ArticleLength;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  // daily | every_3_days | weekly | biweekly | monthly
  @IsOptional()
  @IsIn(CADENCES)
  cadence?: string;

  // How many ideas to brainstorm when `items` isn't supplied.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  articleCount?: number;

  // Cap on total articles ever generated. Defaults to the number of ideas;
  // pass null for an open-ended (never-completing) plan.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  totalTarget?: number | null;

  @IsOptional()
  @IsBoolean()
  autoPublish?: boolean;

  // Cluster seed keywords, used to steer the brainstorm and attached to items.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetKeyword?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  relatedKeywords?: string[];

  // Explicit ideas — when present, skips the AI brainstorm.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanItemInput)
  items?: PlanItemInput[];

  // Dispatch the first article on the next scheduler tick (default true).
  @IsOptional()
  @IsBoolean()
  startNow?: boolean;
}
