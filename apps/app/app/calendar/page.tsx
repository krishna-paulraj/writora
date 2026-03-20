"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import moment from "moment";
import { momentLocalizer } from "react-big-calendar";
import type { Event } from "react-big-calendar";
import { SiteHeader } from "@/components/site-header";
import ShadcnBigCalendar from "@/components/calender/calendar";

const localizer = momentLocalizer(moment);
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface BlogEvent extends Event {
  id: string;
  variant: string;
}

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<BlogEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/analytics/calendar`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        setEvents(
          data.map(
            (e: {
              id: string;
              title: string;
              start: string;
              end: string;
              variant: string;
            }) => ({
              ...e,
              start: new Date(e.start),
              end: new Date(e.end),
            }),
          ),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectEvent = useCallback(
    (event: BlogEvent) => {
      router.push(`/blogs/${event.id}/edit`);
    },
    [router],
  );

  const eventPropGetter = useCallback((event: BlogEvent) => {
    return {
      className: `event-variant-${event.variant || "primary"}`,
    };
  }, []);

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
        <div>
          <h2 className="text-lg font-semibold">Blog Calendar</h2>
          <p className="text-muted-foreground text-sm">
            View your blog posts on a calendar. Click a post to edit it.
          </p>
        </div>

        <div style={{ height: 700 }}>
          <ShadcnBigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={handleSelectEvent}
            eventPropGetter={eventPropGetter}
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
