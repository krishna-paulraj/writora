import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BlogModule } from '../blog/blog.module';
import { ContentPlanModule } from '../content-plan/content-plan.module';
import { InternalCronController } from './internal-cron.controller';
import { CronSecretGuard } from './cron-secret.guard';

/**
 * Internal, machine-only endpoints (not part of the public/app API). Currently
 * the cron-trigger used by an external scheduler on sleep-prone hosts. Imports
 * Blog/ContentPlan/Ai modules to reuse their scheduler/reaper services.
 */
@Module({
  imports: [BlogModule, ContentPlanModule, AiModule],
  controllers: [InternalCronController],
  providers: [CronSecretGuard],
})
export class InternalModule {}
