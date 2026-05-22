import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.service';

// ThrottlerStorageRecord isn't re-exported from the package root, so we
// mirror its shape locally — keep in sync with @nestjs/throttler.
interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/**
 * Redis-backed storage for @nestjs/throttler. Reuses the existing CacheModule
 * connection. If Redis is unavailable (no URL or down), increments succeed
 * with totalHits=0 so throttling fails OPEN — better availability than
 * locking everyone out.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis | null) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    if (!this.redis) {
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    const blockKey = `${key}:blocked`;

    try {
      // If client is currently blocked, short-circuit.
      const blockedTtl = await this.redis.pttl(blockKey);
      if (blockedTtl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: 0,
          isBlocked: true,
          timeToBlockExpire: blockedTtl,
        };
      }

      const pipeline = this.redis.pipeline();
      pipeline.incr(key);
      pipeline.pttl(key);
      const results = await pipeline.exec();
      if (!results) throw new Error('pipeline returned null');

      const totalHits = Number(results[0][1] ?? 0);
      let timeToExpire = Number(results[1][1] ?? -1);

      if (timeToExpire < 0) {
        await this.redis.pexpire(key, ttl);
        timeToExpire = ttl;
      }

      if (totalHits > limit) {
        if (blockDuration > 0) {
          await this.redis.set(blockKey, '1', 'PX', blockDuration);
        }
        return {
          totalHits,
          timeToExpire,
          isBlocked: true,
          timeToBlockExpire: blockDuration,
        };
      }

      return {
        totalHits,
        timeToExpire,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    } catch (err) {
      this.logger.warn(
        `throttler increment failed (fail-open): ${err instanceof Error ? err.message : err}`,
      );
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
