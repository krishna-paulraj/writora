"use client";

import { SiteHeader } from "@/components/site-header";
import { EventForm } from "@/components/calender/event-form";
import ShadcnBigCalendar from "@/components/calender/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import moment from "moment";
import { ComponentType, SetStateAction, useState } from "react";
import type { CalendarProps } from "react-big-calendar";
import { momentLocalizer, SlotInfo, Views } from "react-big-calendar";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import { Plus } from "lucide-react";

const DnDCalendar = withDragAndDrop<CalendarEvent>(
  ShadcnBigCalendar as ComponentType<CalendarProps<CalendarEvent>>,
);
const localizer = momentLocalizer(moment);

type CalendarEvent = {
  title: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  variant?: "primary" | "secondary" | "outline";
};

const startOfToday = new Date();
startOfToday.setHours(0, 0, 0, 0);

const createDate = (dayOffset: number, hours: number, minutes = 0) => {
  const date = new Date(startOfToday);
  date.setDate(startOfToday.getDate() + dayOffset);
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const presetEvents: CalendarEvent[] = [
  {
    title: "Product design sync",
    start: createDate(0, 9, 30),
    end: createDate(0, 12, 30),
    variant: "primary",
  },
  {
    title: "Customer onboarding",
    start: createDate(1, 13),
    end: createDate(1, 14, 30),
    variant: "secondary",
  },
  {
    title: "Deep work block",
    start: createDate(2, 11),
    end: createDate(2, 13),
    variant: "outline",
  },
  {
    title: "Prepare Presentation",
    start: createDate(-2, 9),
    end: createDate(-2, 13),
    variant: "secondary",
  },
  {
    title: "Team offsite",
    start: createDate(-1, 0),
    end: createDate(1, 0),
    allDay: true,
    variant: "secondary",
  },
  {
    title: "Retro & planning",
    start: createDate(3, 15),
    end: createDate(3, 16, 30),
    variant: "primary",
  },
  {
    title: "Quarterly roadmap",
    start: createDate(30, 10),
    end: createDate(30, 11, 30),
    variant: "primary",
  },
  {
    title: "Partner demo",
    start: createDate(32, 14),
    end: createDate(32, 15),
    variant: "secondary",
  },
  {
    title: "Billing review",
    start: createDate(34, 9),
    end: createDate(34, 11),
    variant: "outline",
  },
  {
    title: "Security tabletop",
    start: createDate(36, 13),
    end: createDate(36, 14, 30),
    variant: "primary",
  },
];

export default function Page() {
  const [view, setView] = useState(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>(() => [
    ...presetEvents,
  ]);
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);

  const eventPropGetter: CalendarProps<CalendarEvent>["eventPropGetter"] = (
    event,
  ) => {
    const variant = event.variant ?? "primary";
    return {
      className: `event-variant-${variant}`,
    };
  };

  const handleNavigate = (newDate: Date) => {
    setDate(newDate);
  };

  const handleViewChange = (newView: SetStateAction<any>) => {
    setView(newView);
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    setSelectedSlot(slotInfo);
  };

  const handleCreateEvent = (data: {
    title: string;
    start: string;
    end: string;
    variant: CalendarEvent["variant"];
  }) => {
    const startDate = new Date(data.start);
    const endDate = new Date(data.end);
    const allDaySelection =
      startDate.getHours() === 0 &&
      startDate.getMinutes() === 0 &&
      endDate.getHours() === 0 &&
      endDate.getMinutes() === 0 &&
      endDate.getTime() - startDate.getTime() >= 24 * 60 * 60 * 1000;

    const newEvent: CalendarEvent = {
      title: data.title,
      start: startDate,
      end: endDate,
      allDay: allDaySelection,
      variant: data.variant ?? "primary",
    };
    setEvents((previous) => [...previous, newEvent]);
    setSelectedSlot(null);
  };

  const deriveAllDay = (
    startDate: Date,
    endDate: Date,
    isAllDay?: boolean,
    fallback?: boolean,
  ) => {
    if (typeof isAllDay === "boolean") return isAllDay;
    const dayDiff = endDate.getTime() - startDate.getTime();
    const startsAtMidnight =
      startDate.getHours() === 0 &&
      startDate.getMinutes() === 0 &&
      startDate.getSeconds() === 0;
    const endsAtMidnight =
      endDate.getHours() === 0 &&
      endDate.getMinutes() === 0 &&
      endDate.getSeconds() === 0;
    if (startsAtMidnight && endsAtMidnight && dayDiff >= 24 * 60 * 60 * 1000) {
      return true;
    }
    if (!startsAtMidnight || dayDiff < 24 * 60 * 60 * 1000) {
      return false;
    }
    return fallback ?? false;
  };

  const clampToSingleDay = (startDate: Date) => {
    const endOfDay = new Date(startDate);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  };

  const handleEventDrop = ({
    event,
    start,
    end,
    isAllDay,
  }: EventInteractionArgs<CalendarEvent>) => {
    const nextStart = new Date(start);
    const nextEnd = new Date(end);
    const nextAllDay = deriveAllDay(nextStart, nextEnd, isAllDay, event.allDay);
    const normalizedEnd =
      !nextAllDay &&
      event.allDay &&
      event.end.getTime() - event.start.getTime() >= 24 * 60 * 60 * 1000
        ? clampToSingleDay(nextStart)
        : nextEnd;
    const updatedEvents = events.map((existingEvent) =>
      existingEvent === event
        ? {
            ...existingEvent,
            start: nextStart,
            end: normalizedEnd,
            allDay: nextAllDay,
          }
        : existingEvent,
    );
    setEvents(updatedEvents);
  };

  const handleEventResize = ({
    event,
    start,
    end,
    isAllDay,
  }: EventInteractionArgs<CalendarEvent>) => {
    const nextStart = new Date(start);
    const nextEnd = new Date(end);
    const nextAllDay = deriveAllDay(nextStart, nextEnd, isAllDay, event.allDay);
    const updatedEvents = events.map((existingEvent) =>
      existingEvent === event
        ? {
            ...existingEvent,
            start: nextStart,
            end: nextEnd,
            allDay: nextAllDay,
          }
        : existingEvent,
    );
    setEvents(updatedEvents);
  };

  return (
    <>
      <SiteHeader title="Calender" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <p className="text-muted-foreground">
                  Add a meeting, workshop, or reminder to the demo.
                </p>
                <Button
                  aria-label="Create a new calendar event"
                  onClick={() =>
                    setSelectedSlot({
                      start: new Date(),
                      end: new Date(),
                      slots: [],
                      action: "click",
                    })
                  }
                >
                  <Plus />
                  Create Event
                </Button>
              </div>

              <Dialog
                open={selectedSlot !== null}
                onOpenChange={() => setSelectedSlot(null)}
              >
                <DialogContent>
                  <DialogHeader>
                    <h3 className="scroll-m-20 text-xl font-semibold tracking-tight">
                      Create Event
                    </h3>
                  </DialogHeader>
                  {selectedSlot && (
                    <EventForm
                      start={selectedSlot.start}
                      end={selectedSlot.end}
                      onSubmit={handleCreateEvent}
                      onCancel={() => setSelectedSlot(null)}
                    />
                  )}
                </DialogContent>
              </Dialog>
              <DnDCalendar
                localizer={localizer}
                style={{ height: 700, width: "100%" }}
                className="border-border border-rounded-md border-solid border-2 rounded-lg"
                selectable
                date={date}
                onNavigate={handleNavigate}
                view={view}
                onView={handleViewChange}
                resizable
                draggableAccessor={() => true}
                resizableAccessor={() => true}
                events={events}
                eventPropGetter={eventPropGetter}
                onSelectSlot={handleSelectSlot}
                onEventDrop={handleEventDrop}
                onEventResize={handleEventResize}
              />
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
