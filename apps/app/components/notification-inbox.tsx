"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  BellIcon,
  CheckIcon,
  GlobeIcon,
  RocketIcon,
  SendIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  type AppNotification,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  timeAgo,
} from "@/lib/notifications";

const POLL_MS = 30_000;

type IconMeta = { Icon: typeof BellIcon; className: string };

function iconFor(type: string): IconMeta {
  switch (type) {
    case "article.completed":
      return { Icon: SparklesIcon, className: "text-emerald-500" };
    case "publish.success":
      return { Icon: SendIcon, className: "text-emerald-500" };
    case "article.failed":
    case "publish.failed":
      return { Icon: AlertTriangleIcon, className: "text-destructive" };
    case "plan.completed":
      return { Icon: RocketIcon, className: "text-primary" };
    case "blog.published":
      return { Icon: GlobeIcon, className: "text-sky-500" };
    default:
      return { Icon: BellIcon, className: "text-muted-foreground" };
  }
}

export function NotificationInbox() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await listNotifications();
      setNotifications(data.items);
      setUnreadCount(data.unreadCount);
    } catch {
      // Silent — background poll or unauthenticated; keep last good state.
    }
  }, []);

  // Initial load — setState lives in the promise callback, not the effect body.
  useEffect(() => {
    let active = true;
    listNotifications()
      .then((data) => {
        if (!active) return;
        setNotifications(data.items);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Background polling so new events surface without a reload.
  useEffect(() => {
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Refresh the moment the user opens the inbox (event handler, not an effect).
  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (next) void load();
    },
    [load],
  );

  const markAsRead = useCallback(
    async (id: string) => {
      const target = notifications.find((n) => n.id === id);
      if (!target || target.read) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await markNotificationRead(id);
      } catch {
        void load(); // reconcile optimistic state on failure
      }
    },
    [notifications, load],
  );

  const markAllAsRead = useCallback(async () => {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      toast.error("Failed to mark all as read");
      void load();
    }
  }, [unreadCount, load]);

  const removeNotification = useCallback(
    async (id: string) => {
      const target = notifications.find((n) => n.id === id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (target && !target.read) setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await deleteNotification(id);
      } catch {
        toast.error("Failed to remove notification");
        void load();
      }
    },
    [notifications, load],
  );

  const handleClick = useCallback(
    (n: AppNotification) => {
      void markAsRead(n.id);
      if (n.link) {
        setOpen(false);
        router.push(n.link);
      }
    },
    [markAsRead, router],
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-8 w-8">
          <BellIcon className="size-4" />
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h4 className="text-sm font-semibold">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-auto p-0 text-xs"
              onClick={markAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
        <Separator />
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
              <BellIcon className="size-8 opacity-30" />
              <p>No notifications</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const { Icon, className } = iconFor(notification.type);
              return (
                <div
                  key={notification.id}
                  role={notification.link ? "button" : undefined}
                  tabIndex={notification.link ? 0 : undefined}
                  onClick={() => handleClick(notification)}
                  onKeyDown={(e) => {
                    if (
                      notification.link &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      handleClick(notification);
                    }
                  }}
                  className={`group hover:bg-muted/50 flex gap-3 px-4 py-3 transition-colors ${
                    notification.link ? "cursor-pointer" : ""
                  } ${!notification.read ? "bg-primary/5" : ""}`}
                >
                  <div className="mt-0.5 shrink-0">
                    <Icon className={`size-4 ${className}`} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm leading-none font-medium">
                      {notification.title}
                    </p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      {notification.body}
                    </p>
                    <p className="text-muted-foreground/60 text-xs">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          void markAsRead(notification.id);
                        }}
                        title="Mark as read"
                      >
                        <CheckIcon className="size-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeNotification(notification.id);
                      }}
                      title="Remove"
                    >
                      <Trash2Icon className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
