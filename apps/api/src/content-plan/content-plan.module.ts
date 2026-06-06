import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { ContentPlanController } from './content-plan.controller';
import { ContentPlanService } from './content-plan.service';
import { ContentPlanSchedulerService } from './content-plan-scheduler.service';

@Module({
  imports: [AuthModule, AiModule],
  controllers: [ContentPlanController],
  providers: [ContentPlanService, ContentPlanSchedulerService],
  exports: [ContentPlanSchedulerService],
})
export class ContentPlanModule {}
