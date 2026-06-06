import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateBlogDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500_000)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  targetKeyword?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  readTime?: number;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsString()
  scheduledAt?: string | null;
}
