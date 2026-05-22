import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheService, REDIS_CLIENT } from './cache.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const url = config.get<string>('REDIS_URL');
        if (!url) return null;

        const logger = new Logger('Redis');
        const client = new Redis(url, {
          maxRetriesPerRequest: 3,
          lazyConnect: false,
          enableReadyCheck: true,
          reconnectOnError(err) {
            const msg = err.message.toLowerCase();
            return msg.includes('readonly');
          },
        });

        client.on('error', (err) => {
          logger.warn(`redis error: ${err.message}`);
        });
        client.on('connect', () => {
          logger.log('connected');
        });

        return client;
      },
    },
    CacheService,
    RedisThrottlerStorage,
  ],
  exports: [CacheService, RedisThrottlerStorage],
})
export class CacheModule {}
