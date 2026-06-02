import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

// Global: site, ai, content-plan, and publish modules all enforce entitlements.
@Global()
@Module({
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
