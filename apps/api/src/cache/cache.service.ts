import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null;

  constructor(@Inject(REDIS_CLIENT) redis: Redis | null) {
    this.redis = redis;
    if (!this.redis) {
      this.logger.log('Redis disabled (REDIS_URL not set) — cache is a no-op');
    }
  }

  onModuleDestroy() {
    if (this.redis) this.redis.disconnect();
  }

  /**
   * Read-through helper. Returns cached value, otherwise computes via `fetch`,
   * caches the result for `ttlSeconds`, and returns it.
   */
  async wrap<T>(
    key: string,
    ttlSeconds: number,
    fetch: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await fetch();
    if (value !== undefined && value !== null) {
      await this.set(key, value, ttlSeconds);
    }
    return value;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      const raw = await this.redis.get(key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(
        `cache get failed for ${key}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(
        `cache set failed for ${key}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.redis || keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(
        `cache del failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * Delete all keys matching a glob pattern. Uses SCAN so it's safe on large
   * keyspaces — never blocks Redis.
   */
  async delPattern(pattern: string): Promise<void> {
    if (!this.redis) return;
    try {
      const stream = this.redis.scanStream({ match: pattern, count: 100 });
      const pipeline = this.redis.pipeline();
      let pending = 0;
      for await (const keys of stream as AsyncIterable<string[]>) {
        for (const key of keys) {
          pipeline.del(key);
          pending++;
        }
      }
      if (pending > 0) await pipeline.exec();
    } catch (err) {
      this.logger.warn(
        `cache delPattern failed for ${pattern}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * SET key value EX ttl NX — returns true if the key was newly set, false if
   * it already existed. Useful for dedup / once-per-window operations.
   */
  async setIfAbsent(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    if (!this.redis) return true; // no redis = treat every call as fresh
    try {
      const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      this.logger.warn(
        `cache setIfAbsent failed for ${key}: ${err instanceof Error ? err.message : err}`,
      );
      return true;
    }
  }
}
