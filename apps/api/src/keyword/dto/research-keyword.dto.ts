import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ResearchKeywordDto {
  @IsString()
  @MaxLength(200)
  seed: string;

  @IsOptional()
  @IsInt()
  locationCode?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  languageCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
