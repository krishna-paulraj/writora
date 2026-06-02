import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CacheService } from '../cache/cache.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { RegisterDto } from './dto/register.dto';

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const PROFILE_CACHE_TTL = 30; // seconds — nav freshness vs DB load

function profileKey(userId: string) {
  return `auth:profile:${userId}`;
}

// Usernames double as the primary site's public slug (/[username]) and must not
// collide with www static routes, the /s/ secondary-site prefix, or the
// /[username] sub-routes — otherwise routing breaks.
const RESERVED_USERNAMES = new Set([
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

function genToken(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
    private cache: CacheService,
    private entitlements: EntitlementsService,
  ) {}

  private wwwUrl(): string {
    return (
      this.configService.get<string>('SITE_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_WWW_URL') ||
      'http://localhost:3000'
    );
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const username = await this.generateUsername(dto.name);
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        username,
        password: hashedPassword,
      },
    });

    // Send email verification (fire-and-forget)
    this.issueEmailVerification(user.id, user.email, user.name).catch(() => {});

    return this.buildResponse(user);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.password) {
      throw new UnauthorizedException('Please sign in with Google');
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid credentials');
    return this.buildResponse(user);
  }

  async getProfile(userId: string) {
    return this.cache.wrap(profileKey(userId), PROFILE_CACHE_TTL, async () => {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new UnauthorizedException('User not found');
      const [sites, entitlements] = await Promise.all([
        this.prisma.site.findMany({
          where: { userId },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            name: true,
            slug: true,
            isPrimary: true,
            blogTheme: true,
            customDomain: true,
          },
        }),
        this.entitlements.summary(userId),
      ]);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        blogTheme: user.blogTheme,
        customDomain: user.customDomain,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        twitterHandle: user.twitterHandle,
        websiteUrl: user.websiteUrl,
        emailVerified: user.emailVerified,
        plan: entitlements.plan,
        entitlements,
        sites,
      };
    });
  }

  private async invalidateUserCache(userId: string, oldUsername?: string) {
    await this.cache.del(profileKey(userId));
    // Public-blog caches keyed by username — invalidate when username or
    // profile fields (bio/avatar/socials) change, since they're surfaced on
    // the public pages.
    if (oldUsername) {
      await this.cache.delPattern(`blog:public:*:${oldUsername}*`);
    }
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      username?: string;
      blogTheme?: string;
      bio?: string;
      avatarUrl?: string;
      twitterHandle?: string;
      websiteUrl?: string;
    },
  ) {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });

    if (data.username) {
      if (RESERVED_USERNAMES.has(data.username.toLowerCase())) {
        throw new ConflictException('That username is reserved');
      }
      const existing = await this.prisma.user.findUnique({
        where: { username: data.username },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Username already taken');
      }
    }

    // customDomain is a gated, per-site setting — handled by PATCH
    // /sites/:id/domain (SiteService), NOT here. Strip it defensively so a
    // legacy client can't write the deprecated, ungated User column.
    const normalized: Record<string, unknown> = { ...data };
    delete normalized.customDomain;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: normalized,
    });

    // Mirror the per-publication profile fields onto the primary site, which is
    // what public pages now render from. (customDomain is gated + per-site, set
    // via PATCH /sites/:id/domain — not mirrored here.)
    const siteFields: Record<string, unknown> = {};
    if (data.blogTheme !== undefined) siteFields.blogTheme = data.blogTheme;
    if (data.bio !== undefined) siteFields.bio = data.bio ?? null;
    if (data.avatarUrl !== undefined)
      siteFields.avatarUrl = data.avatarUrl ?? null;
    if (data.twitterHandle !== undefined)
      siteFields.twitterHandle = data.twitterHandle ?? null;
    if (data.websiteUrl !== undefined)
      siteFields.websiteUrl = data.websiteUrl ?? null;
    if (Object.keys(siteFields).length > 0) {
      await this.prisma.site.updateMany({
        where: { userId, isPrimary: true },
        data: siteFields,
      });
    }
    await this.invalidateUserCache(userId, current?.username);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      blogTheme: user.blogTheme,
      customDomain: user.customDomain,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      twitterHandle: user.twitterHandle,
      websiteUrl: user.websiteUrl,
      emailVerified: user.emailVerified,
    };
  }

  async findOrCreateGoogleUser(googleProfile: {
    googleId: string;
    email: string;
    name: string;
  }) {
    const existingByGoogleId = await this.prisma.user.findUnique({
      where: { googleId: googleProfile.googleId },
    });
    if (existingByGoogleId) return this.buildResponse(existingByGoogleId);

    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: googleProfile.email },
    });
    if (existingByEmail) {
      const updated = await this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: googleProfile.googleId,
          emailVerified: existingByEmail.emailVerified ?? new Date(),
        },
      });
      return this.buildResponse(updated);
    }

    const username = await this.generateUsername(googleProfile.name);
    const user = await this.prisma.user.create({
      data: {
        name: googleProfile.name,
        email: googleProfile.email,
        username,
        googleId: googleProfile.googleId,
        emailVerified: new Date(),
      },
    });
    return this.buildResponse(user);
  }

  generateToken(user: { id: string; email: string }) {
    return this.jwtService.sign({ sub: user.id, email: user.email });
  }

  // --- Email verification ----------------------------------------------------

  async issueEmailVerification(
    userId: string,
    email: string,
    name: string,
  ): Promise<void> {
    // Invalidate previous tokens for this user
    await this.prisma.emailVerification.deleteMany({ where: { userId } });

    const token = genToken();
    await this.prisma.emailVerification.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
      },
    });

    const verifyUrl = `${this.wwwUrl()}/verify-email/${token}`;
    await this.emailService.sendVerifyEmail(email, name, verifyUrl);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }
    await this.issueEmailVerification(user.id, user.email, user.name);
  }

  async verifyEmail(token: string): Promise<{ ok: true }> {
    const record = await this.prisma.emailVerification.findUnique({
      where: { token },
    });
    if (!record) throw new BadRequestException('Invalid verification link');
    if (record.expiresAt < new Date()) {
      await this.prisma.emailVerification.delete({ where: { id: record.id } });
      throw new BadRequestException('Verification link expired');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: new Date() },
      }),
      this.prisma.emailVerification.delete({ where: { id: record.id } }),
    ]);
    await this.cache.del(profileKey(record.userId));
    return { ok: true };
  }

  // --- Password reset --------------------------------------------------------

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Don't disclose whether the email exists
    if (!user || !user.password) return;

    await this.prisma.passwordReset.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const token = genToken();
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${this.wwwUrl()}/reset-password/${token}`;
    await this.emailService.sendPasswordReset(user.email, user.name, resetUrl);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const record = await this.prisma.passwordReset.findUnique({
      where: { token },
    });
    if (!record || record.usedAt) {
      throw new BadRequestException('Invalid or already-used reset link');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Reset link expired');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      }),
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  // --- Helpers ---------------------------------------------------------------

  private async generateUsername(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);
    const username = base || 'user';
    let suffix = 0;

    while (true) {
      const candidate = suffix === 0 ? username : `${username}${suffix}`;
      // Skip reserved words and any in-use username, plus existing Site slugs
      // (username seeds the primary site's slug, which is globally unique).
      if (!RESERVED_USERNAMES.has(candidate)) {
        const [existingUser, existingSite] = await Promise.all([
          this.prisma.user.findUnique({ where: { username: candidate } }),
          this.prisma.site.findUnique({ where: { slug: candidate } }),
        ]);
        if (!existingUser && !existingSite) return candidate;
      }
      suffix++;
    }
  }

  private buildResponse(user: {
    id: string;
    name: string;
    email: string;
    username: string;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
    };
  }
}
