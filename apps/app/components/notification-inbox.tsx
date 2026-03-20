"use client";

import { useState } from "react";
import { BellIcon, CheckIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
}

const sampleNotifications: Notification[] = [
  {
    id: "1",
    title: "Welcome to Writora!",
    description:
      "Start by creating your first blog post. Click on Blogs in the sidebar to get started.",
    time: "Just now",
    read: false,
  },
];

export function NotificationInbox() {
  const [notifications, setNotifications] =
    useState<Notification[]>(sampleNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-8 w-8">
          <BellIcon className="size-4" />
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full text-[10px] font-medium">
              {unreadCount}
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
              className="text-muted-foreground h-auto p-0 text-xs hover:text-foreground"
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
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`group flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                  !notification.read ? "bg-primary/5" : ""
                }`}
              >
                <div
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    notification.read ? "bg-transparent" : "bg-primary"
                  }`}
                />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {notification.title}
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {notification.description}
                  </p>
                  <p className="text-muted-foreground/60 text-xs">
                    {notification.time}
                  </p>
                </div>
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => markAsRead(notification.id)}
                      title="Mark as read"
                    >
                      <CheckIcon className="size-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    onClick={() => removeNotification(notification.id)}
                    title="Remove"
                  >
                    <Trash2Icon className="size-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
