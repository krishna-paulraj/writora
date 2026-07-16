import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

function genToken(): string {
  return randomBytes(32).toString('hex');
}

// Confirm tokens are stored hashed (like auth's reset/verify tokens) so a
// read-only DB leak doesn't yield working confirmation links; 256 bits of
// entropy makes unsalted SHA-256 sufficient and keeps lookup an indexed
// equality. Unsubscribe tokens are deliberately NOT hashed: every newsletter
// blast must embed the raw token in its footer link, so the value has to stay
// recoverable (worst case of a leak there is an unwanted unsubscribe).
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
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

    // The raw token only ever exists in the email link; the row keeps its
    // hash. On a repeat subscribe we can't recover the raw value to re-send,
    // so rotate: the newest email's link wins, older ones die.
    const confirmToken = genToken();

    if (existing) {
      await this.prisma.subscriber.update({
        where: { id: existing.id },
        data: { confirmToken: hashToken(confirmToken) },
      });
    } else {
      await this.prisma.subscriber.create({
        data: {
          authorId: author.id,
          siteId,
          email: normalized,
          confirmToken: hashToken(confirmToken),
          unsubscribeToken: genToken(),
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
    // Hashed lookup, with a raw-value fallback so confirmation links emailed
    // before hashing shipped keep working (their rows store the raw token).
    const record = await this.prisma.subscriber.findFirst({
      where: { confirmToken: { in: [hashToken(token), token] } },
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
