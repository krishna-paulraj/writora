import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveKeywordDto {
  @IsString()
  @MaxLength(200)
  keyword: string;

  @IsOptional()
  @IsNumber()
  searchVolume?: number | null;

  @IsOptional()
  @IsNumber()
  difficulty?: number | null;

  @IsOptional()
  @IsNumber()
  competition?: number | null;

  @IsOptional()
  @IsNumber()
  cpc?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seed?: string | null;
}
