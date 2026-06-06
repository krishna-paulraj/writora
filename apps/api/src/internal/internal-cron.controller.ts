import { Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { BlogSchedulerService } from '../blog/blog-scheduler.service';
import { ContentPlanSchedulerService } from '../content-plan/content-plan-scheduler.service';
import { CronSecretGuard } from './cron-secret.guard';

/**
 * Trigger endpoint for hosts whose web service sleeps when idle (e.g. Render's
 * free tier), where the in-process @Cron jobs don't fire while asleep. An
 * external scheduler (cron-job.org) POSTs here every few minutes; the request
 * also wakes the dyno from sleep.
 *
 * It reuses the existing scheduler ticks, so it inherits their re-entrancy
 * guards and error handling and stays a single source of truth. Safe to call
 * repeatedly and concurrently — the underlying work (publish-due posts, run-due
 * plans) only ever acts on items that are actually due.
 */
@UseGuards(CronSecretGuard)
@Controller('internal/cron')
export class InternalCronController {
  constructor(
    private readonly blogScheduler: BlogSchedulerService,
    private readonly contentPlanScheduler: ContentPlanSchedulerService,
  ) {}

  @Post('tick')
  @HttpCode(200)
  async tick() {
    // Run both independently so one slow/failing tick doesn't skip the other.
    // Each tick() swallows and logs its own errors, so this never rejects.
    await Promise.all([
      this.blogScheduler.tick(),
      this.contentPlanScheduler.tick(),
    ]);
    return { ok: true };
  }
}
