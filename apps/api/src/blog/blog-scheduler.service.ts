import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BlogService } from './blog.service';

@Injectable()
export class BlogSchedulerService {
  private readonly logger = new Logger(BlogSchedulerService.name);
  private running = false;

  constructor(private blogService: BlogService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    // Re-entrancy guard: if a previous tick is still working (slow DB or many
    // posts), skip this one. Next minute will pick up the slack.
    if (this.running) return;
    this.running = true;
    try {
      await this.blogService.publishDuePosts();
    } catch (err) {
      this.logger.error(
        `publishDuePosts failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      this.running = false;
    }
  }
}
