import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  blogTheme?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  avatarUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  twitterHandle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  websiteUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  imageStyle?: string;

  @IsOptional()
  @IsBoolean()
  autoGenerateImages?: boolean;
}
