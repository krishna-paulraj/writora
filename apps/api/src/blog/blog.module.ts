import { Module } from '@nestjs/common';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { BlogSchedulerService } from './blog-scheduler.service';

@Module({
  controllers: [BlogController],
  providers: [BlogService, BlogSchedulerService],
  exports: [BlogService, BlogSchedulerService],
})
export class BlogModule {}
