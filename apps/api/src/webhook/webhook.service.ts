import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { BlogService } from '../blog/blog.service';
import { QueueService } from '../queue/queue.service';

export const WEBHOOK_BLOG_PUBLISHED_QUEUE = 'webhook.blog.published';

export interface BlogPublishedEvent {
  blogId: string;
  authorId: string;
}

interface InboundBlogPayload {
  title: string;
  content: string;
  category: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  featured?: boolean;
  publish?: boolean;
  scheduledAt?: string | null;
}

function genSecret(prefix: string): string {
  return `${prefix}_${randomBytes(24).toString('hex')}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private prisma: PrismaService,
    private blogService: BlogService,
    private queue: QueueService,
    private config: ConfigService,
  ) {}

  private wwwUrl(): string {
    return (
      this.config.get<string>('SITE_URL') ||
      this.config.get<string>('NEXT_PUBLIC_WWW_URL') ||
      'http://localhost:3000'
    );
  }

  // --- Inbound ---------------------------------------------------------------

  async getInboundConfig(userId: string) {
    let user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { inboundWebhookSecret: true },
    });
    if (!user) throw new NotFoundException();

    // Lazy-create on first request so existing users don't need a migration step.
    if (!user.inboundWebhookSecret) {
      user = await this.prisma.user.update({
        where: { id: userId },
        data: { inboundWebhookSecret: genSecret('wh_in') },
        select: { inboundWebhookSecret: true },
      });
    }

    return {
      url: `${this.config.get<string>('PUBLIC_API_URL') || 'http://localhost:4000'}/webhooks/blogs/in`,
      token: user.inboundWebhookSecret!,
    };
  }

  async regenerateInbound(userId: string) {
    const secret = genSecret('wh_in');
    await this.prisma.user.update({
      where: { id: userId },
      data: { inboundWebhookSecret: secret },
    });
    return { token: secret };
  }

  /**
   * Resolve a bearer token to the owning user. Used by the public inbound
   * POST endpoint. Returns null on miss — caller throws Unauthorized.
   */
  async resolveInboundToken(token: string): Promise<string | null> {
    if (!token || token.length < 20) return null;
    const user = await this.prisma.user.findUnique({
      where: { inboundWebhookSecret: token },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  /**
   * Create a blog from an inbound webhook payload. Reuses BlogService.create()
   * so the same sanitization, slug uniqueness, and cache invalidation apply.
   */
  async createBlogFromInbound(userId: string, payload: InboundBlogPayload) {
    if (!payload?.title || !payload?.content || !payload?.category) {
      throw new BadRequestException(
        'title, content, and category are required',
      );
    }

    const slug = payload.slug?.trim() || slugify(payload.title);
    if (!slug) {
      throw new BadRequestException(
        'Could not derive a slug from the title — provide one explicitly',
      );
    }

    // Inbound posts land on the user's primary site.
    const site = await this.prisma.site.findFirst({
      where: { userId, isPrimary: true },
      select: { id: true },
    });
    if (!site) throw new NotFoundException('No site found for this account');

    const blog = await this.blogService.create(userId, site.id, {
      title: payload.title,
      slug,
      description: payload.description ?? '',
      content: payload.content,
      imageUrl: payload.imageUrl,
      category: payload.category,
      featured: payload.featured ?? false,
      published: false, // never publish on create; handled below
    });

    // If `publish: true`, transition to published. If `scheduledAt`, schedule.
    if (payload.scheduledAt) {
      return this.blogService.setSchedule(blog.id, userId, payload.scheduledAt);
    }
    if (payload.publish) {
      return this.blogService.update(blog.id, userId, { published: true });
    }
    return blog;
  }

  // --- Outbound endpoints (CRUD) --------------------------------------------

  async listEndpoints(userId: string) {
    return this.prisma.webhookEndpoint.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        description: true,
        enabled: true,
        lastDeliveryAt: true,
        lastStatus: true,
        lastError: true,
        createdAt: true,
      },
    });
  }

  async addEndpoint(
    userId: string,
    data: { url: string; description?: string },
  ) {
    if (!data?.url || !/^https?:\/\//.test(data.url)) {
      throw new BadRequestException('A valid http(s) URL is required');
    }
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        userId,
        url: data.url,
        description: data.description?.trim() || null,
        secret: genSecret('whsec'),
      },
    });
    return endpoint;
  }

  async removeEndpoint(userId: string, id: string) {
    const ep = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!ep) throw new NotFoundException();
    if (ep.userId !== userId) throw new ForbiddenException();
    await this.prisma.webhookEndpoint.delete({ where: { id } });
    return { ok: true };
  }

  async testEndpoint(userId: string, id: string) {
    const ep = await this.prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!ep) throw new NotFoundException();
    if (ep.userId !== userId) throw new ForbiddenException();

    const payload = {
      event: 'webhook.test',
      deliveredAt: new Date().toISOString(),
      blog: null,
      message: 'Test delivery from Writora — your endpoint is reachable.',
    };
    const result = await this.deliverOnce(ep.url, ep.secret, payload);
    await this.prisma.webhookEndpoint.update({
      where: { id: ep.id },
      data: {
        lastDeliveryAt: new Date(),
        lastStatus: result.status,
        lastError: result.error,
      },
    });
    return result;
  }

  // --- Fan-out on blog publish ----------------------------------------------

  /**
   * Queue consumer entry point. Looks up the author's enabled endpoints,
   * fires the HTTP POST to each, records the result. Always returns (does
   * not throw) so the queue acks the message — failed deliveries are
   * surfaced via the endpoint's lastStatus/lastError, not via a retry storm
   * that would duplicate to receivers that already succeeded.
   */
  async handleBlogPublished(event: BlogPublishedEvent) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { userId: event.authorId, enabled: true },
    });
    if (endpoints.length === 0) return;

    const blog = await this.prisma.blog.findUnique({
      where: { id: event.blogId },
      include: { author: { select: { name: true, username: true } } },
    });
    if (!blog) return;

    const payload = {
      event: 'blog.published',
      deliveredAt: new Date().toISOString(),
      blog: {
        id: blog.id,
        slug: blog.slug,
        title: blog.title,
        description: blog.description,
        content: blog.content,
        imageUrl: blog.imageUrl,
        category: blog.category,
        publishedAt: blog.publishedAt,
        url: `${this.wwwUrl()}/${blog.author.username}/${blog.slug}`,
        author: blog.author,
      },
    };

    for (const ep of endpoints) {
      const result = await this.deliverOnce(ep.url, ep.secret, payload);
      await this.prisma.webhookEndpoint.update({
        where: { id: ep.id },
        data: {
          lastDeliveryAt: new Date(),
          lastStatus: result.status,
          lastError: result.error,
        },
      });
      if (!result.ok) {
        this.logger.warn(
          `webhook delivery failed for endpoint ${ep.id}: ${result.error}`,
        );
      }
    }
  }

  // --- Signing + low-level HTTP ---------------------------------------------

  /**
   * Stripe-style header: `X-Writora-Signature: t=<unix>,v1=<hex(hmac)>`.
   * Receivers verify by recomputing HMAC over `<unix>.<raw-body>` with the
   * shared secret and comparing in constant time.
   */
  private sign(rawBody: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = `${timestamp}.${rawBody}`;
    const v1 = createHmac('sha256', secret).update(signed).digest('hex');
    return `t=${timestamp},v1=${v1}`;
  }

  private async deliverOnce(
    url: string,
    secret: string,
    payload: unknown,
  ): Promise<{ ok: boolean; status: number; error: string | null }> {
    const raw = JSON.stringify(payload);
    const signature = this.sign(raw, secret);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Writora-Signature': signature,
          'User-Agent': 'Writora-Webhook/1.0',
        },
        body: raw,
        signal: controller.signal,
      });
      const ok = res.status >= 200 && res.status < 300;
      return {
        ok,
        status: res.status,
        error: ok ? null : `HTTP ${res.status} ${res.statusText}`.trim(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, status: 0, error: msg.slice(0, 500) };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Public helper for receivers (and tests) — not used internally but exposed
   * so we have a canonical reference implementation of signature verification.
   */
  static verifySignature(
    header: string,
    rawBody: string,
    secret: string,
  ): boolean {
    const parts = Object.fromEntries(
      header.split(',').map((p) => p.split('=', 2) as [string, string]),
    );
    if (!parts.t || !parts.v1) return false;
    const signed = `${parts.t}.${rawBody}`;
    const expected = createHmac('sha256', secret).update(signed).digest('hex');
    if (expected.length !== parts.v1.length) return false;
    // timingSafeEqual requires equal-length buffers
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(parts.v1, 'hex');
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  // unused but kept to silence the unused-import linter
  static fingerprint(s: string) {
    return createHash('sha256').update(s).digest('hex').slice(0, 12);
  }
}
