import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BlogModule } from './blog/blog.module';
import { CategoryModule } from './category/category.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UploadModule } from './upload/upload.module';
import { EmailModule } from './email/email.module';
import { SubscriberModule } from './subscriber/subscriber.module';
import { CacheModule } from './cache/cache.module';
import { QueueModule } from './queue/queue.module';
import { StorageModule } from './storage/storage.module';
import { AiModule } from './ai/ai.module';
import { WebhookModule } from './webhook/webhook.module';
import { KeywordModule } from './keyword/keyword.module';
import { SeoModule } from './seo/seo.module';
import { ContentPlanModule } from './content-plan/content-plan.module';
import { PublishModule } from './publish/publish.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { SiteModule } from './site/site.module';
import { BillingModule } from './billing/billing.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { NetworkModule } from './network/network.module';
import { BacklinkModule } from './backlink/backlink.module';
import { RedisThrottlerStorage } from './cache/redis-throttler.storage';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    CacheModule,
    QueueModule,
    StorageModule,
    EmbeddingModule,
    BacklinkModule,
    EmailModule,
    AuthModule,
    BlogModule,
    CategoryModule,
    AnalyticsModule,
    UploadModule,
    SubscriberModule,
    AiModule,
    WebhookModule,
    KeywordModule,
    SeoModule,
    ContentPlanModule,
    PublishModule,
    NotificationsModule,
    EntitlementsModule,
    SiteModule,
    BillingModule,
    NetworkModule,
    ThrottlerModule.forRootAsync({
      imports: [CacheModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        // Global default — generous baseline for hot read paths.
        // Strict per-route overrides are applied via @Throttle() decorators.
        throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
        storage,
        // Honor X-Forwarded-For when behind a proxy (Vercel/Cloudflare/etc.)
        getTracker: (req: { ips?: string[]; ip?: string }) =>
          (req.ips && req.ips.length ? req.ips[0] : req.ip) ?? 'unknown',
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
