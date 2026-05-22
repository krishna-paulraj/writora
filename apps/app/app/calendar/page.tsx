"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import moment from "moment";
import { momentLocalizer } from "react-big-calendar";
import type { Event } from "react-big-calendar";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import ShadcnBigCalendar from "@/components/calender/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const localizer = momentLocalizer(moment);
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Variant = "scheduled" | "published" | "draft";

interface BlogEvent extends Event {
  id: string;
  variant: Variant;
  published: boolean;
  scheduledAt: string | null;
}

interface ApiEvent {
  id: string;
  title: string;
  slug: string;
  start: string;
  end: string;
  variant: Variant;
  published: boolean;
  scheduledAt: string | null;
}

type Filter = "all" | Variant;

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<BlogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    fetch(`${API_URL}/analytics/calendar`, { credentials: "include" })
      .then((res) => res.json())
      .then((data: ApiEvent[]) => {
        setEvents(
          data.map((e) => ({
            id: e.id,
            title: e.title,
            start: new Date(e.start),
            end: new Date(e.end),
            allDay: true,
            variant: e.variant,
            published: e.published,
            scheduledAt: e.scheduledAt,
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () =>
      filter === "all" ? events : events.filter((e) => e.variant === filter),
    [events, filter],
  );

  const handleSelectEvent = useCallback(
    (event: object) => {
      const e = event as BlogEvent;
      router.push(`/blogs/${e.id}/edit`);
    },
    [router],
  );

  const eventPropGetter = useCallback((event: object) => {
    const e = event as BlogEvent;
    return { className: `event-variant-${e.variant}` };
  }, []);

  // Only scheduled posts can be dragged — drafts have no anchor date and
  // published posts shouldn't be retroactively rescheduled.
  const draggableAccessor = useCallback(
    (event: object) => (event as BlogEvent).variant === "scheduled",
    [],
  );

  const handleEventDrop = useCallback(
    async ({ event, start }: { event: object; start: Date | string }) => {
      const e = event as BlogEvent;
      if (e.variant !== "scheduled") return;
      const newStart = typeof start === "string" ? new Date(start) : start;

      // Preserve original time-of-day when dropping on a new day (month view
      // zeros the time component).
      const original = e.scheduledAt
        ? new Date(e.scheduledAt)
        : new Date(e.start as Date);
      newStart.setHours(original.getHours(), original.getMinutes(), 0, 0);

      if (newStart.getTime() < Date.now() - 30_000) {
        toast.error("Can't schedule in the past");
        return;
      }

      const prev = events;
      const isoString = newStart.toISOString();
      setEvents((cur) =>
        cur.map((ev) =>
          ev.id === e.id
            ? { ...ev, start: newStart, end: newStart, scheduledAt: isoString }
            : ev,
        ),
      );

      try {
        const res = await fetch(`${API_URL}/blogs/${e.id}/schedule`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ scheduledAt: isoString }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(
          `Rescheduled to ${moment(newStart).format("MMM D, h:mm A")}`,
        );
      } catch {
        setEvents(prev);
        toast.error("Failed to reschedule");
      }
    },
    [events],
  );

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "scheduled", label: "Scheduled" },
    { id: "published", label: "Published" },
    { id: "draft", label: "Drafts" },
  ];

  if (loading) {
    return (
      <>
        <SiteHeader title="Calendar" />
        <div className="text-muted-foreground py-24 text-center">
          Loading...
        </div>
      </>
    );
  }

  return (
    <>
      <SiteHeader title="Calendar" />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Blog Calendar</h2>
            <p className="text-muted-foreground text-sm">
              Drag a scheduled post to reschedule. Click any post to edit it.
            </p>
          </div>
          <div className="flex gap-1">
            {filters.map((f) => (
              <Button
                key={f.id}
                variant={filter === f.id ? "default" : "ghost"}
                size="sm"
                onClick={() => setFilter(f.id)}
                className={cn("capitalize")}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        <div style={{ height: 700 }}>
          <ShadcnBigCalendar
            localizer={localizer}
            events={filtered}
            startAccessor={(e: object) => (e as BlogEvent).start as Date}
            endAccessor={(e: object) => (e as BlogEvent).end as Date}
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventPropGetter}
            draggableAccessor={draggableAccessor}
            onEventDrop={handleEventDrop}
            resizable={false}
            views={["month", "week", "agenda"]}
            defaultView="month"
            popup
            style={{ height: "100%" }}
          />
        </div>
      </div>
    </>
  );
}
