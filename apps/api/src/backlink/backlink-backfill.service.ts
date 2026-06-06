import { Injectable, OnModuleInit } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { BacklinkService } from './backlink.service';

export const BACKLINK_BACKFILL_QUEUE = 'backlink.backfill';

interface BackfillJob {
  blogId: string;
}

/**
 * Consumes "a post just published" events and adds inbound backlinks to it from
 * relevant existing member posts. Idempotent + best-effort (the handler no-ops
 * when the site isn't an entitled member).
 */
@Injectable()
export class BacklinkBackfillService implements OnModuleInit {
  constructor(
    private queue: QueueService,
    private backlinks: BacklinkService,
  ) {}

  async onModuleInit() {
    await this.queue.consume<BackfillJob>(
      BACKLINK_BACKFILL_QUEUE,
      (job) => this.backlinks.backfillInbound(job.blogId).then(() => undefined),
      { prefetch: 1 },
    );
  }

  async enqueue(blogId: string): Promise<void> {
    await this.queue.enqueue<BackfillJob>(BACKLINK_BACKFILL_QUEUE, { blogId });
  }
}
