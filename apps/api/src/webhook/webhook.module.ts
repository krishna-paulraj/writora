import { Module, OnModuleInit } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import {
  WebhookService,
  WEBHOOK_BLOG_PUBLISHED_QUEUE,
} from './webhook.service';
import type { BlogPublishedEvent } from './webhook.service';
import { AuthModule } from '../auth/auth.module';
import { BlogModule } from '../blog/blog.module';
import { QueueService } from '../queue/queue.service';

@Module({
  imports: [AuthModule, BlogModule],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule implements OnModuleInit {
  constructor(
    private webhooks: WebhookService,
    private queue: QueueService,
  ) {}

  async onModuleInit() {
    await this.queue.consume<BlogPublishedEvent>(
      WEBHOOK_BLOG_PUBLISHED_QUEUE,
      (job) => this.webhooks.handleBlogPublished(job),
      { prefetch: 5 },
    );
  }
}
