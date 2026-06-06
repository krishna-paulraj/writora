import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ScoreSeoDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  contentHtml?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetKeyword?: string;

  @IsOptional()
  @IsIn(['short', 'medium', 'long'])
  length?: 'short' | 'medium' | 'long';
}
