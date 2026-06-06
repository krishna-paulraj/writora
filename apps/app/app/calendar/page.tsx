"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import moment from "moment";
import { momentLocalizer } from "react-big-calendar";
import type { Event } from "react-big-calendar";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import ShadcnBigCalendar from "@/components/calender/calendar";
import { QuickAddDialog } from "@/components/quick-add-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import {
  getPlannerEvents,
  quickAddArticle,
  reschedulePlanItem,
  type PlannerEvent,
  type PlannerVariant,
} from "@/lib/content-plans";

const localizer = momentLocalizer(moment);

interface CalEvent extends Event {
  id: string;
  variant: PlannerVariant;
  raw: PlannerEvent;
}

type Filter = "all" | PlannerVariant;

function toCalEvent(e: PlannerEvent): CalEvent {
  return {
    id: e.id,
    title: e.title,
    start: new Date(e.start),
    end: new Date(e.end),
    allDay: true,
    variant: e.variant,
    raw: e,
  };
}

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddDay, setQuickAddDay] = useState<Date | null>(null);

  // Refetch helper (used after quick-add). Runs from an event handler.
  const load = useCallback(async () => {
    try {
      const data = await getPlannerEvents();
      setEvents(data.map(toCalEvent));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load planner");
    }
  }, []);

  // Initial load — setState lives in the promise callbacks, not the effect body.
  useEffect(() => {
    let active = true;
    getPlannerEvents()
      .then((data) => {
        if (active) setEvents(data.map(toCalEvent));
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Failed to load planner"),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      filter === "all" ? events : events.filter((e) => e.variant === filter),
    [events, filter],
  );

  const handleSelectEvent = useCallback(
    (event: object) => {
      const e = event as CalEvent;
      if (e.raw.kind === "blog") router.push(`/blogs/${e.raw.id}/edit`);
      else router.push(`/autopilot/${e.raw.planId}`);
    },
    [router],
  );

  const eventPropGetter = useCallback(
    (event: object) => ({
      className: `event-variant-${(event as CalEvent).variant}`,
    }),
    [],
  );

  // Scheduled blog posts and not-yet-generated AI articles can be dragged.
  // Published/draft blogs and in-flight AI items have no movable anchor.
  const draggableAccessor = useCallback((event: object) => {
    const e = event as CalEvent;
    return e.variant === "scheduled" || e.variant === "ai-planned";
  }, []);

  const handleEventDrop = useCallback(
    async ({ event, start }: { event: object; start: Date | string }) => {
      const e = event as CalEvent;
      const raw = e.raw;
      const newStart = typeof start === "string" ? new Date(start) : start;

      // Preserve the original time-of-day (month view zeros it on drop).
      const originalIso =
        raw.kind === "blog" ? (raw.scheduledAt ?? raw.start) : raw.start;
      const original = new Date(originalIso);
      newStart.setHours(original.getHours(), original.getMinutes(), 0, 0);

      if (newStart.getTime() < Date.now() - 30_000) {
        toast.error("Can't schedule in the past");
        return;
      }
      const iso = newStart.toISOString();

      // Optimistic move; restore on failure.
      const prev = events;
      setEvents((cur) =>
        cur.map((ev) =>
          ev.id === e.id ? patchEventDate(ev, newStart, iso) : ev,
        ),
      );

      try {
        if (raw.kind === "blog" && raw.variant === "scheduled") {
          const res = await apiFetch(`/blogs/${raw.id}/schedule`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scheduledAt: iso }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } else if (raw.kind === "plan" && raw.variant === "ai-planned") {
          await reschedulePlanItem(raw.planId, raw.id, iso);
        } else {
          setEvents(prev); // not a movable event — undo the optimistic flip
          return;
        }
        toast.success(
          `Rescheduled to ${moment(newStart).format("MMM D, h:mm A")}`,
        );
      } catch (err) {
        setEvents(prev);
        toast.error(
          err instanceof Error ? err.message : "Failed to reschedule",
        );
      }
    },
    [events],
  );

  const handleSelectSlot = useCallback(
    ({ start }: { start: Date | string }) => {
      setQuickAddDay(typeof start === "string" ? new Date(start) : start);
      setQuickAddOpen(true);
    },
    [],
  );

  const handleQuickAdd = useCallback(
    async (title: string, iso: string) => {
      try {
        await quickAddArticle({ title, scheduledFor: iso });
        toast.success("Article added to the planner");
        await load();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to add article",
        );
      }
    },
    [load],
  );

  // Show the current month and the next month side by side. With the toolbar
  // removed there's no in-calendar navigation, so each calendar is pinned to a
  // fixed month via the controlled `date` prop.
  const months = useMemo(
    () => [
      moment().startOf("month").toDate(),
      moment().add(1, "month").startOf("month").toDate(),
    ],
    [],
  );

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "ai-planned", label: "AI planned" },
    { id: "ai-generating", label: "AI generating" },
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
            <h2 className="text-lg font-semibold">Content Planner</h2>
            <p className="text-muted-foreground text-sm">
              Click a day to plan an AI article. Drag planned articles or
              scheduled posts to reschedule. Click any item to open it.
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
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

        <div className="grid gap-6 xl:grid-cols-2">
          {months.map((m) => (
            <div key={m.toISOString()} className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">
                {moment(m).format("MMMM YYYY")}
              </h3>
              <div style={{ height: 600 }}>
                <ShadcnBigCalendar
                  localizer={localizer}
                  events={filtered}
                  date={m}
                  onNavigate={() => {}}
                  startAccessor={(e: object) => (e as CalEvent).start as Date}
                  endAccessor={(e: object) => (e as CalEvent).end as Date}
                  onSelectEvent={handleSelectEvent}
                  onSelectSlot={handleSelectSlot}
                  selectable
                  eventPropGetter={eventPropGetter}
                  draggableAccessor={draggableAccessor}
                  onEventDrop={handleEventDrop}
                  resizable={false}
                  views={["month"]}
                  defaultView="month"
                  toolbar={false}
                  popup
                  style={{ height: "100%" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        seedDate={quickAddDay}
        onConfirm={handleQuickAdd}
      />
    </>
  );
}

// Returns a copy of the event moved to `when`, updating the raw payload's date
// fields so the optimistic state matches what the server now holds.
function patchEventDate(ev: CalEvent, when: Date, iso: string): CalEvent {
  const raw: PlannerEvent =
    ev.raw.kind === "blog"
      ? { ...ev.raw, start: iso, end: iso, scheduledAt: iso }
      : { ...ev.raw, start: iso, end: iso };
  return { ...ev, start: when, end: when, raw };
}
