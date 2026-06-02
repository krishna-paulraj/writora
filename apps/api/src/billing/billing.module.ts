import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { StripeService } from './stripe.service';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [StripeService],
  exports: [StripeService],
})
export class BillingModule {}
