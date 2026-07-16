import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type { ArticleLength, Tone } from '../ai.service';

const TONES = ['professional', 'casual', 'friendly', 'witty', 'confident'];
const LENGTHS = ['short', 'medium', 'long'];

export class GenerateArticleDto {
  @IsString()
  @MaxLength(300)
  topic: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetKeyword?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  relatedKeywords?: string[];

  @IsOptional()
  @IsIn(TONES)
  tone?: Tone;

  @IsOptional()
  @IsIn(LENGTHS)
  length?: ArticleLength;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  audience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;
}
