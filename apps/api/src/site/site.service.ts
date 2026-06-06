import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

// Slugs that would collide with www static routes or the /s/ prefix.
const RESERVED_SLUGS = new Set([
  's',
  'api',
  'admin',
  'app',
  'www',
  'dashboard',
  'settings',
  'login',
  'signup',
  'logout',
  'about',
  'pricing',
  'contact',
  'privacy',
  'terms',
  'faq',
  'blog',
  'feed',
  'sitemap',
  'robots',
  'verify-email',
  'forgot-password',
  'reset-password',
  'confirm-subscription',
  'unsubscribe',
]);

const PUBLIC_SITE_SELECT = {
  id: true,
  name: true,
  slug: true,
  subdomain: true,
  isPrimary: true,
  blogTheme: true,
  customDomain: true,
  bio: true,
  avatarUrl: true,
  twitterHandle: true,
  websiteUrl: true,
  imageStyle: true,
  autoGenerateImages: true,
  createdAt: true,
} satisfies Prisma.SiteSelect;

function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class SiteService {
  constructor(
    private prisma: PrismaService,
    private entitlements: EntitlementsService,
  ) {}

  private validateSlug(slug: string): string {
    const s = normalizeSlug(slug);
    if (s.length < 3 || s.length > 40) {
      throw new BadRequestException('Slug must be 3–40 characters');
    }
    if (RESERVED_SLUGS.has(s)) {
      throw new BadRequestException(`"${s}" is reserved`);
    }
    return s;
  }

  list(userId: string) {
    return this.prisma.site.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: PUBLIC_SITE_SELECT,
    });
  }

  async get(userId: string, id: string) {
    const site = await this.ensureOwned(userId, id);
    return this.project(site);
  }

  async create(userId: string, dto: CreateSiteDto) {
    // These DTOs carry no class-validator decorators, so the global pipe won't
    // coerce/validate types — guard against non-string bodies before trimming.
    const name = typeof dto.name === 'string' ? dto.name.trim() : '';
    if (!name) throw new BadRequestException('name is required');
    if (typeof dto.slug !== 'string' || !dto.slug.trim()) {
      throw new BadRequestException('slug is required');
    }
    const slug = this.validateSlug(dto.slug);
    const blogTheme =
      typeof dto.blogTheme === 'string' && dto.blogTheme.trim()
        ? dto.blogTheme.trim()
        : 'default';

    await this.entitlements.assertCanCreateSite(userId);
    await this.assertSlugFree(slug);

    try {
      const site = await this.prisma.site.create({
        data: {
          userId,
          name,
          slug,
          isPrimary: false,
          blogTheme,
        },
        select: PUBLIC_SITE_SELECT,
      });
      return site;
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('That slug is already taken');
      }
      throw err;
    }
  }

  async update(userId: string, id: string, dto: UpdateSiteDto) {
    const site = await this.ensureOwned(userId, id);
    const data: Prisma.SiteUpdateInput = {};

    if (typeof dto.name === 'string') {
      const n = dto.name.trim();
      if (!n) throw new BadRequestException('name cannot be empty');
      data.name = n;
    }
    if (typeof dto.slug === 'string') {
      // The primary site's slug is kept in lockstep with the username (public
      // routing is /[username]); it can only change by renaming the account.
      if (site.isPrimary) {
        throw new BadRequestException(
          'Your primary site URL follows your username — change it from your profile instead.',
        );
      }
      const slug = this.validateSlug(dto.slug);
      await this.assertSlugFree(slug, id);
      data.slug = slug;
    }
    if (typeof dto.blogTheme === 'string')
      data.blogTheme = dto.blogTheme.trim();
    if (dto.bio !== undefined) data.bio = dto.bio?.trim() || null;
    if (dto.avatarUrl !== undefined)
      data.avatarUrl = dto.avatarUrl?.trim() || null;
    if (dto.twitterHandle !== undefined)
      data.twitterHandle = dto.twitterHandle?.trim() || null;
    if (dto.websiteUrl !== undefined)
      data.websiteUrl = dto.websiteUrl?.trim() || null;
    if (typeof dto.imageStyle === 'string')
      data.imageStyle = dto.imageStyle.trim() || 'digital_illustration';
    if (typeof dto.autoGenerateImages === 'boolean')
      data.autoGenerateImages = dto.autoGenerateImages;

    try {
      return this.project(
        await this.prisma.site.update({
          where: { id },
          data,
          select: PUBLIC_SITE_SELECT,
        }),
      );
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('That slug is already taken');
      }
      throw err;
    }
  }

  /** Custom domain is plan-gated and globally unique. */
  async setCustomDomain(userId: string, id: string, domain: string | null) {
    await this.ensureOwned(userId, id);
    const value = domain?.trim().toLowerCase() || null;
    if (value) {
      await this.entitlements.assertCustomDomain(userId);
      // Proper FQDN: ≤253 chars, ≥2 dot-separated labels, each label 1–63 chars
      // of [a-z0-9] not starting/ending with a hyphen, TLD ≥2 letters. Rejects
      // the loose cases the old regex let through (-.com, a..b.com, .x.com).
      const valid =
        value.length <= 253 &&
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(value);
      if (!valid) {
        throw new BadRequestException(
          'Enter a valid domain (e.g. blog.example.com)',
        );
      }
    }
    try {
      return this.project(
        await this.prisma.site.update({
          where: { id },
          data: { customDomain: value },
          select: PUBLIC_SITE_SELECT,
        }),
      );
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        throw new BadRequestException('That domain is already connected');
      }
      throw err;
    }
  }

  async remove(userId: string, id: string) {
    const site = await this.ensureOwned(userId, id);
    if (site.isPrimary) {
      throw new BadRequestException('Your primary site cannot be deleted');
    }
    await this.prisma.site.delete({ where: { id } });
    return { ok: true as const };
  }

  /**
   * Resolve the active site for a request: the requested (owned) site, else the
   * user's primary, lazily creating a primary if somehow absent (defensive for
   * a half-migrated/dev DB). Returns the site id.
   */
  async resolveCurrentSite(
    userId: string,
    requestedSiteId?: string | null,
  ): Promise<string> {
    if (requestedSiteId) {
      const owned = await this.prisma.site.findFirst({
        where: { id: requestedSiteId, userId },
        select: { id: true },
      });
      if (owned) return owned.id;
      // Requested an unowned/unknown site → silently fall back to primary.
    }
    const primary = await this.prisma.site.findFirst({
      where: { userId, isPrimary: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (primary) return primary.id;
    return (await this.ensurePrimarySite(userId)).id;
  }

  /** Idempotently ensure the user has a primary site (backfill safety net). */
  async ensurePrimarySite(userId: string): Promise<{ id: string }> {
    const existing = await this.prisma.site.findFirst({
      where: { userId, isPrimary: true },
      select: { id: true },
    });
    if (existing) return existing;

    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        name: true,
        blogTheme: true,
        customDomain: true,
        bio: true,
        avatarUrl: true,
        twitterHandle: true,
        websiteUrl: true,
      },
    });
    if (!u) throw new NotFoundException('User not found');
    try {
      return await this.prisma.site.create({
        data: {
          userId,
          name: u.name,
          slug: u.username,
          isPrimary: true,
          blogTheme: u.blogTheme,
          customDomain: u.customDomain,
          bio: u.bio,
          avatarUrl: u.avatarUrl,
          twitterHandle: u.twitterHandle,
          websiteUrl: u.websiteUrl,
        },
        select: { id: true },
      });
    } catch (err) {
      // Lost a race — another request created it; re-read.
      if (this.isUniqueViolation(err)) {
        const again = await this.prisma.site.findFirst({
          where: { userId, isPrimary: true },
          select: { id: true },
        });
        if (again) return again;
      }
      throw err;
    }
  }

  private async assertSlugFree(slug: string, exceptId?: string): Promise<void> {
    const existing = await this.prisma.site.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existing && existing.id !== exceptId) {
      throw new BadRequestException('That slug is already taken');
    }
  }

  private async ensureOwned(userId: string, id: string) {
    const site = await this.prisma.site.findUnique({ where: { id } });
    if (!site) throw new NotFoundException('Site not found');
    if (site.userId !== userId) throw new ForbiddenException();
    return site;
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    );
  }

  private project(site: {
    id: string;
    name: string;
    slug: string;
    subdomain: string | null;
    isPrimary: boolean;
    blogTheme: string;
    customDomain: string | null;
    bio: string | null;
    avatarUrl: string | null;
    twitterHandle: string | null;
    websiteUrl: string | null;
    imageStyle: string;
    autoGenerateImages: boolean;
    createdAt: Date;
  }) {
    return site;
  }
}
