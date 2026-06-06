import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(100)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  blogTheme?: string;
}
