import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Notification `type` values. Drives the client-side icon/accent per kind. */
export const NotificationType = {
  ArticleCompleted: 'article.completed',
  ArticleFailed: 'article.failed',
  PublishSuccess: 'publish.success',
  PublishFailed: 'publish.failed',
  PlanCompleted: 'plan.completed',
  BlogPublished: 'blog.published',
  BacklinkEarned: 'backlink.earned',
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];

export interface NotifyInput {
  type: NotificationTypeValue;
  title: string;
  body: string;
  /** In-app route the row links to, e.g. `/blogs` or `/autopilot/:id`. */
  link?: string | null;
  /** Related ids for future deep-linking (blogId, jobId, planId, …). */
  meta?: Record<string, unknown> | null;
}

// Keep the inbox bounded — only the most recent slice is ever shown/fetched.
const MAX_LIST = 30;
// Trim long error/topic strings so a notification body never balloons.
const MAX_BODY = 500;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Best-effort notification creation for event hooks (queue consumers,
   * schedulers, publish fanout). NEVER throws — a notification is a
   * side-effect of the real work, so a failure here must not abort generation,
   * publishing, or ack-ing a queue message. Failures are logged and swallowed.
   */
  async emit(userId: string, input: NotifyInput): Promise<void> {
    try {
      if (!userId || !input?.title) return;
      await this.prisma.notification.create({
        data: {
          userId,
          type: input.type,
          title: input.title.slice(0, 200),
          body: (input.body ?? '').slice(0, MAX_BODY),
          link: input.link ?? null,
          meta:
            input.meta == null
              ? Prisma.DbNull
              : (input.meta as Prisma.InputJsonValue),
        },
      });
    } catch (err) {
      this.logger.warn(
        `failed to emit notification for ${userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Recent notifications (newest first) plus the live unread count. */
  async list(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: MAX_LIST,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          read: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({ where: { userId, read: false } }),
    ]);
    return { items, unreadCount };
  }

  // The mutations below are owner-scoped via the WHERE clause (id + userId), so
  // they're atomic, leak no existence info across users, and are idempotent —
  // acting on a missing/foreign notification simply affects 0 rows.
  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { ok: true as const };
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return { ok: true as const, updated: res.count };
  }

  async remove(userId: string, id: string) {
    await this.prisma.notification.deleteMany({ where: { id, userId } });
    return { ok: true as const };
  }
}
