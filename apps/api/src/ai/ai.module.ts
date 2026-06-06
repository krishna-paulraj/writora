import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ArticleGenerationService } from './article-generation.service';
import { ImageGenerationService } from './image-generation.service';
import { AuthModule } from '../auth/auth.module';
import { BlogModule } from '../blog/blog.module';

@Module({
  imports: [AuthModule, BlogModule],
  controllers: [AiController],
  providers: [AiService, ArticleGenerationService, ImageGenerationService],
  exports: [AiService, ArticleGenerationService, ImageGenerationService],
})
export class AiModule {}
