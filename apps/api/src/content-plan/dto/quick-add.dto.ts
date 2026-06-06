import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class QuickAddDto {
  @IsString()
  @MaxLength(300)
  title: string;

  // ISO date the article should generate/publish on.
  @IsString()
  scheduledFor: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetKeyword?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  keywords?: string[];
}
