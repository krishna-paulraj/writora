import { Module, OnModuleInit } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../crypto/crypto.module';
import { AiModule } from '../ai/ai.module';
import { QueueService } from '../queue/queue.service';
import { PublishController } from './publish.controller';
import {
  PublishService,
  CMS_PUBLISH_FANOUT_QUEUE,
  CmsPublishEvent,
} from './publish.service';
import { WordPressAdapter } from './adapters/wordpress.adapter';
import { DevtoAdapter } from './adapters/devto.adapter';
import { XAdapter } from './adapters/x.adapter';

@Module({
  imports: [AuthModule, CryptoModule, AiModule],
  controllers: [PublishController],
  providers: [PublishService, WordPressAdapter, DevtoAdapter, XAdapter],
})
export class PublishModule implements OnModuleInit {
  constructor(
    private publish: PublishService,
    private queue: QueueService,
  ) {}

  async onModuleInit() {
    // Auto cross-post fanout — its own queue (RabbitMQ consumers on one queue
    // compete, so this must NOT share the webhook publish queue).
    await this.queue.consume<CmsPublishEvent>(
      CMS_PUBLISH_FANOUT_QUEUE,
      (job) => this.publish.handleBlogPublished(job),
      { prefetch: 5 },
    );
  }
}
