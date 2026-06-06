import { IsArray, IsOptional, IsString } from 'class-validator';

export class PublishBlogDto {
  // Specific destinations to publish to; when omitted, all enabled ones.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetIds?: string[];
}
