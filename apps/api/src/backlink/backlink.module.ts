import { Global, Module } from '@nestjs/common';
import { BacklinkService } from './backlink.service';
import { BacklinkBackfillService } from './backlink-backfill.service';

// Global: the AI generation pipeline (outbound at generation) and the blog
// publish path (backfill/cleanup) both use it.
@Global()
@Module({
  providers: [BacklinkService, BacklinkBackfillService],
  exports: [BacklinkService, BacklinkBackfillService],
})
export class BacklinkModule {}
