import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBlogDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  @MaxLength(300)
  slug: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsString()
  @MaxLength(500_000)
  content: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  imageUrl?: string;

  @IsString()
  @MaxLength(100)
  category: string;

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
}
