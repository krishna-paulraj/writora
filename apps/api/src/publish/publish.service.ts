import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Blog, PublishRecord, PublishTarget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../crypto/crypto.service';
import { WordPressAdapter } from './adapters/wordpress.adapter';
import { DevtoAdapter } from './adapters/devto.adapter';
import { XAdapter } from './adapters/x.adapter';
import { PublishAdapter, PublishBlogInput } from './adapters/types';
import { CreateTargetDto } from './dto/create-target.dto';
import { UpdateTargetDto } from './dto/update-target.dto';
import {
  NotificationsService,
  NotificationType,
} from '../notifications/notifications.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

export const CMS_PUBLISH_FANOUT_QUEUE = 'cms.publish.fanout';

export interface CmsPublishEvent {
  blogId: string;
  authorId: string;
}

type BlogWithAuthor = Blog & { author: { username: string } };

@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);
  private readonly adapters: Map<string, PublishAdapter>;

  constructor(
    private prisma: PrismaService,
    private crypto: CryptoService,
    private config: ConfigService,
    private notifications: NotificationsService,
    private entitlements: EntitlementsService,
    wordpress: WordPressAdapter,
    devto: DevtoAdapter,
    x: XAdapter,
  ) {
    this.adapters = new Map<string, PublishAdapter>([
      [wordpress.platform, wordpress],
      [devto.platform, devto],
      [x.platform, x],
    ]);
  }

  private wwwUrl(): string {
    return (
      this.config.get<string>('SITE_URL') ||
      this.config.get<string>('NEXT_PUBLIC_WWW_URL') ||
      'http://localhost:3000'
    );
  }

  private adapterFor(platform: string): PublishAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new BadRequestException(`Unsupported platform: ${platform}`);
    }
    return adapter;
  }

  private ensureCrypto(): void {
    if (!this.crypto.isConfigured()) {
      throw new ServiceUnavailableException(
        'Credential encryption is not configured on this server (set ENCRYPTION_KEY)',
      );
    }
  }

  // --- Target CRUD -----------------------------------------------------------

  /** Lists the active site's destinations. Never returns encrypted credentials. */
  async listTargets(userId: string, siteId: string) {
    return this.prisma.publishTarget.findMany({
      where: { userId, siteId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        platform: true,
        name: true,
        enabled: true,
        autoPublish: true,
        lastPublishAt: true,
        lastStatus: true,
        lastError: true,
        createdAt: true,
      },
    });
  }

  async addTarget(userId: string, siteId: string, dto: CreateTargetDto) {
    this.ensureCrypto();
    const platform = dto.platform?.trim();
    const name = dto.name?.trim();
    if (!platform) throw new BadRequestException('platform is required');
    if (!name) throw new BadRequestException('name is required');
    // Destinations are plan-gated (count + availability).
    await this.entitlements.assertCanAddDestination(userId);

    const adapter = this.adapterFor(platform);
    const creds = dto.credentials ?? {};
    adapter.validate(creds);

    const target = await this.prisma.publishTarget.create({
      data: {
        userId,
        siteId,
        platform,
        name,
        credentials: this.crypto.encryptJson(creds),
        enabled: true,
        autoPublish: dto.autoPublish ?? false,
      },
    });
    return this.sanitizeTarget(target);
  }

  async updateTarget(userId: string, id: string, dto: UpdateTargetDto) {
    const target = await this.ensureOwned(userId, id);
    const data: Record<string, unknown> = {};

    if (typeof dto.name === 'string') {
      const n = dto.name.trim();
      if (!n) throw new BadRequestException('name cannot be empty');
      data.name = n;
    }
    if (typeof dto.enabled === 'boolean') data.enabled = dto.enabled;
    if (typeof dto.autoPublish === 'boolean')
      data.autoPublish = dto.autoPublish;
    if (dto.credentials) {
      this.ensureCrypto();
      this.adapterFor(target.platform).validate(dto.credentials);
      data.credentials = this.crypto.encryptJson(dto.credentials);
    }

    const updated = await this.prisma.publishTarget.update({
      where: { id },
      data,
    });
    return this.sanitizeTarget(updated);
  }

  async removeTarget(userId: string, id: string) {
    await this.ensureOwned(userId, id);
    await this.prisma.publishTarget.delete({ where: { id } });
    return { ok: true as const };
  }

  async testTarget(userId: string, id: string) {
    const target = await this.ensureOwned(userId, id);
    this.ensureCrypto();
    const adapter = this.adapterFor(target.platform);
    const creds = this.crypto.decryptJson<Record<string, unknown>>(
      target.credentials,
    );
    const result = await adapter.test(creds);
    await this.prisma.publishTarget.update({
      where: { id },
      data: {
        lastStatus: result.ok ? 'ok' : 'error',
        lastError: result.ok ? null : (result.info ?? 'connection failed'),
      },
    });
    return result;
  }

  // --- Publishing ------------------------------------------------------------

  /** Manually publish a (published) blog to specific targets, or all enabled. */
  async publishBlog(userId: string, blogId: string, targetIds?: string[]) {
    this.ensureCrypto();
    const blog = await this.loadOwnedBlog(userId, blogId);
    if (!blog.published) {
      throw new BadRequestException(
        'Publish the post on Writora before cross-posting it',
      );
    }

    // Only the blog's own site's destinations (matches the auto-fanout path).
    let targets = await this.prisma.publishTarget.findMany({
      where: { userId, siteId: blog.siteId, enabled: true },
    });
    if (targetIds && targetIds.length) {
      const wanted = new Set(targetIds);
      targets = targets.filter((t) => wanted.has(t.id));
    }
    if (targets.length === 0) {
      throw new BadRequestException('No matching enabled destinations');
    }

    const records: PublishRecord[] = [];
    for (const target of targets) {
      records.push(await this.publishToTarget(target, blog));
    }
    return records;
  }

  /** Per-blog publish history across destinations (for the post's UI). */
  async listRecords(userId: string, blogId: string) {
    await this.loadOwnedBlog(userId, blogId);
    return this.prisma.publishRecord.findMany({
      where: { blogId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        targetId: true,
        status: true,
        externalUrl: true,
        error: true,
        updatedAt: true,
        target: { select: { id: true, platform: true, name: true } },
      },
    });
  }

  /**
   * Queue consumer for auto cross-posting. Looks up the author's enabled
   * auto-publish targets and pushes the freshly-published blog to each. Always
   * resolves (never throws) so the queue acks — failures are recorded on the
   * PublishRecord/target, not retried into a storm of duplicate posts.
   */
  async handleBlogPublished(event: CmsPublishEvent): Promise<void> {
    // Wrapped end-to-end: this is a queue consumer, so it must never reject
    // (a throw would nack/redeliver and risk duplicate cross-posts).
    try {
      if (!this.crypto.isConfigured()) return;

      const blog = await this.prisma.blog.findUnique({
        where: { id: event.blogId },
        include: { author: { select: { username: true } } },
      });
      // Defence-in-depth: only fan out a published post that actually belongs
      // to the event's author.
      if (!blog || !blog.published || blog.authorId !== event.authorId) return;

      // Only the post's own site's enabled auto-publish destinations.
      const targets = await this.prisma.publishTarget.findMany({
        where: {
          userId: event.authorId,
          siteId: blog.siteId,
          enabled: true,
          autoPublish: true,
        },
      });
      if (targets.length === 0) return;

      for (const target of targets) {
        await this.publishToTarget(target, blog); // never throws (see below)
      }
    } catch (err) {
      this.logger.warn(
        `auto cross-post fanout for blog ${event.blogId} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // --- internals -------------------------------------------------------------

  /**
   * Publishes one blog to one target and upserts the (target, blog)
   * PublishRecord. The prior external id is handed to the adapter so the remote
   * post is UPDATED rather than duplicated. Records failures instead of letting
   * them bubble, so a multi-target publish doesn't abort partway.
   */
  private async publishToTarget(
    target: PublishTarget,
    blog: BlogWithAuthor,
  ): Promise<PublishRecord> {
    try {
      // Everything that can throw (unknown platform, credential decrypt,
      // record lookup, the network publish) lives in the try so a single bad
      // target is recorded as failed rather than aborting a multi-target run.
      const adapter = this.adapterFor(target.platform);
      const creds = this.crypto.decryptJson<Record<string, unknown>>(
        target.credentials,
      );
      const existing = await this.prisma.publishRecord.findUnique({
        where: { targetId_blogId: { targetId: target.id, blogId: blog.id } },
      });

      const input: PublishBlogInput = {
        blogId: blog.id,
        title: blog.title,
        slug: blog.slug,
        description: blog.description,
        contentHtml: blog.content,
        imageUrl: blog.imageUrl,
        category: blog.category,
        canonicalUrl: `${this.wwwUrl()}/${blog.author.username}/${blog.slug}`,
        existingExternalId: existing?.externalId ?? null,
      };

      const result = await adapter.publish(creds, input);
      const record = await this.prisma.publishRecord.upsert({
        where: { targetId_blogId: { targetId: target.id, blogId: blog.id } },
        create: {
          targetId: target.id,
          blogId: blog.id,
          status: 'success',
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          error: null,
        },
        update: {
          status: 'success',
          externalId: result.externalId,
          externalUrl: result.externalUrl,
          error: null,
        },
      });
      await this.prisma.publishTarget.update({
        where: { id: target.id },
        data: { lastPublishAt: new Date(), lastStatus: 'ok', lastError: null },
      });
      await this.notifications.emit(target.userId, {
        type: NotificationType.PublishSuccess,
        title: `Published to ${target.name}`,
        body: `“${blog.title}” is now live on ${target.name}.`,
        link: '/destinations',
        meta: {
          blogId: blog.id,
          targetId: target.id,
          externalUrl: result.externalUrl,
        },
      });
      return record;
    } catch (err) {
      const message = (err instanceof Error ? err.message : String(err)).slice(
        0,
        500,
      );
      const record = await this.prisma.publishRecord.upsert({
        where: { targetId_blogId: { targetId: target.id, blogId: blog.id } },
        create: {
          targetId: target.id,
          blogId: blog.id,
          status: 'failed',
          error: message,
        },
        update: { status: 'failed', error: message },
      });
      await this.prisma.publishTarget.update({
        where: { id: target.id },
        data: {
          lastPublishAt: new Date(),
          lastStatus: 'error',
          lastError: message,
        },
      });
      await this.notifications.emit(target.userId, {
        type: NotificationType.PublishFailed,
        title: `Couldn’t publish to ${target.name}`,
        body: `“${blog.title}” failed to publish: ${message}`,
        link: '/destinations',
        meta: { blogId: blog.id, targetId: target.id },
      });
      return record;
    }
  }

  private async loadOwnedBlog(
    userId: string,
    blogId: string,
  ): Promise<BlogWithAuthor> {
    const blog = await this.prisma.blog.findUnique({
      where: { id: blogId },
      include: { author: { select: { username: true } } },
    });
    if (!blog) throw new NotFoundException('Blog not found');
    if (blog.authorId !== userId) throw new ForbiddenException();
    return blog;
  }

  private async ensureOwned(
    userId: string,
    id: string,
  ): Promise<PublishTarget> {
    const target = await this.prisma.publishTarget.findUnique({
      where: { id },
    });
    if (!target) throw new NotFoundException('Destination not found');
    if (target.userId !== userId) throw new ForbiddenException();
    return target;
  }

  private sanitizeTarget(target: PublishTarget) {
    // Strip the encrypted credentials before returning to the client.
    const { credentials: _credentials, ...rest } = target;
    void _credentials;
    return rest;
  }
}
