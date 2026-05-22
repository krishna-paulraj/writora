"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarIcon, ClockIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing scheduledAt (ISO) — populates the picker on open. */
  value: string | null;
  /** Called with an ISO string when user confirms. */
  onConfirm: (isoString: string) => void;
}

function nextHalfHour(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  // round up to next 30-minute mark
  const minutes = d.getMinutes();
  const add = minutes >= 30 ? 60 - minutes : 30 - minutes;
  d.setMinutes(minutes + add);
  // if that lands less than 1 hour from now, bump another 30 min
  if (d.getTime() - Date.now() < 30 * 60_000) {
    d.setMinutes(d.getMinutes() + 30);
  }
  return d;
}

function toTimeInputValue(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function ScheduleDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
}: ScheduleDialogProps) {
  const initial = useMemo(
    () => (value ? new Date(value) : nextHalfHour()),
    [value],
  );
  const [date, setDate] = useState<Date | undefined>(initial);
  const [time, setTime] = useState(toTimeInputValue(initial));

  // Re-seed state whenever the dialog is opened so re-opens don't show stale
  // values from a previous interaction.
  useEffect(() => {
    if (open) {
      setDate(initial);
      setTime(toTimeInputValue(initial));
    }
  }, [open, initial]);

  const combined = useMemo(() => {
    if (!date) return null;
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const out = new Date(date);
    out.setHours(hh, mm, 0, 0);
    return out;
  }, [date, time]);

  // 30s grace tolerance for clock skew between client and server.
  const isPast = combined ? combined.getTime() < Date.now() - 30_000 : true;
  const isValid = combined && !isPast;

  const submit = () => {
    if (!combined || !isValid) return;
    onConfirm(combined.toISOString());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule publish</DialogTitle>
          <DialogDescription>
            Your post will go live automatically at this time. Subscribers will
            receive the newsletter then.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <CalendarIcon className="size-4" />
              Date
            </Label>
            <div className="rounded-lg border">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                disabled={(d) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return d < today;
                }}
                initialFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="time"
              className="flex items-center gap-2 text-sm font-medium"
            >
              <ClockIcon className="size-4" />
              Time
            </Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full"
            />
          </div>

          {combined && (
            <p
              className={`text-sm ${
                isValid ? "text-muted-foreground" : "text-destructive"
              }`}
            >
              {isValid
                ? `Will publish ${format(combined, "EEEE, MMMM d 'at' h:mm a")}`
                : "Schedule time must be in the future"}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!isValid}>
            Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
