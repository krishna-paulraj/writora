const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type NotificationType =
  | "article.completed"
  | "article.failed"
  | "publish.success"
  | "publish.failed"
  | "plan.completed"
  | "blog.published";

export interface AppNotification {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: AppNotification[];
  unreadCount: number;
}

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.text().catch(() => "");
  return body || `${fallback} (${res.status})`;
}

export async function listNotifications(): Promise<NotificationList> {
  const res = await fetch(`${API_URL}/notifications`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Failed to load notifications"));
  }
  return (await res.json()) as NotificationList;
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/notifications/${id}/read`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to mark as read"));
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${API_URL}/notifications/read-all`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to mark all read"));
}

export async function deleteNotification(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/notifications/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await readError(res, "Failed to remove"));
}

/** Compact "time ago" for a past timestamp, e.g. "just now", "5m", "3d". */
export function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}
