import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContentPlanService } from './content-plan.service';

@Injectable()
export class ContentPlanSchedulerService {
  private readonly logger = new Logger(ContentPlanSchedulerService.name);
  private running = false;

  constructor(private contentPlans: ContentPlanService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    // Re-entrancy guard: a slow tick (inline generation when RabbitMQ is off,
    // or many due plans) shouldn't overlap the next one.
    if (this.running) return;
    this.running = true;
    try {
      await this.contentPlans.runDuePlans();
    } catch (err) {
      this.logger.error(
        `runDuePlans failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
