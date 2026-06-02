import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

function genToken(): string {
  return randomBytes(32).toString('hex');
}

@Injectable()
export class SubscriberService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  private wwwUrl(): string {
    return (
      this.configService.get<string>('SITE_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_WWW_URL') ||
      'http://localhost:3000'
    );
  }

  async subscribe(username: string, email: string): Promise<{ ok: true }> {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new BadRequestException('Invalid email address');
    }

    // Subscriptions via /[username] attach to the user's PRIMARY site. (Per-
    // secondary-site subscribe widgets are deferred — see Phase 5 notes.)
    const author = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        sites: {
          where: { isPrimary: true },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!author) throw new NotFoundException('Author not found');
    const siteId = author.sites[0]?.id;
    if (!siteId) throw new NotFoundException('Author not found');

    const existing = await this.prisma.subscriber.findUnique({
      where: { authorId_email: { authorId: author.id, email: normalized } },
    });

    if (existing?.confirmedAt) {
      // Already confirmed — silently succeed (don't disclose subscription state)
      return { ok: true };
    }

    const confirmToken = existing?.confirmToken ?? genToken();
    const unsubscribeToken = existing?.unsubscribeToken ?? genToken();

    if (!existing) {
      await this.prisma.subscriber.create({
        data: {
          authorId: author.id,
          siteId,
          email: normalized,
          confirmToken,
          unsubscribeToken,
        },
      });
    }

    const confirmUrl = `${this.wwwUrl()}/${author.username}/confirm-subscription/${confirmToken}`;
    await this.emailService.sendSubscribeConfirm(
      normalized,
      author.name,
      confirmUrl,
    );

    return { ok: true };
  }

  async confirm(token: string) {
    const record = await this.prisma.subscriber.findUnique({
      where: { confirmToken: token },
      include: { author: { select: { name: true, username: true } } },
    });
    if (!record) throw new BadRequestException('Invalid confirmation link');
    if (record.confirmedAt) {
      return {
        authorName: record.author.name,
        username: record.author.username,
        alreadyConfirmed: true,
      };
    }
    await this.prisma.subscriber.update({
      where: { id: record.id },
      data: { confirmedAt: new Date() },
    });
    return {
      authorName: record.author.name,
      username: record.author.username,
      alreadyConfirmed: false,
    };
  }

  async unsubscribe(token: string) {
    const record = await this.prisma.subscriber.findUnique({
      where: { unsubscribeToken: token },
      include: { author: { select: { name: true, username: true } } },
    });
    if (!record) throw new BadRequestException('Invalid unsubscribe link');
    await this.prisma.subscriber.delete({ where: { id: record.id } });
    return { authorName: record.author.name, username: record.author.username };
  }

  async listForAuthor(authorId: string, siteId: string) {
    const subs = await this.prisma.subscriber.findMany({
      where: { authorId, siteId, confirmedAt: { not: null } },
      orderBy: { confirmedAt: 'desc' },
      select: { id: true, email: true, confirmedAt: true },
    });
    const pending = await this.prisma.subscriber.count({
      where: { authorId, siteId, confirmedAt: null },
    });
    return { confirmed: subs, pendingCount: pending, total: subs.length };
  }

  /** Confirmed subscribers of a specific site, for that site's newsletter blast. */
  async listConfirmedForBlast(siteId: string) {
    return this.prisma.subscriber.findMany({
      where: { siteId, confirmedAt: { not: null } },
      select: { email: true, unsubscribeToken: true },
    });
  }

  async removeForAuthor(authorId: string, subscriberId: string) {
    const sub = await this.prisma.subscriber.findUnique({
      where: { id: subscriberId },
    });
    if (!sub || sub.authorId !== authorId) {
      throw new NotFoundException('Subscriber not found');
    }
    await this.prisma.subscriber.delete({ where: { id: subscriberId } });
    return { ok: true };
  }
}
