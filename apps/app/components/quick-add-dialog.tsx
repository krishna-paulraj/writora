"use client";

import { useMemo, useState } from "react";
import {
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  SparklesIcon,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface QuickAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Day the user clicked — seeds the date (time defaults to 9:00am). */
  seedDate: Date | null;
  /** Called with the title + chosen ISO date; may be async (dialog closes after). */
  onConfirm: (title: string, isoString: string) => Promise<void> | void;
}

export function QuickAddDialog({
  open,
  onOpenChange,
  seedDate,
  onConfirm,
}: QuickAddDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Plan an article</DialogTitle>
          <DialogDescription>
            Autopilot will write this article and schedule it for the date
            below.
          </DialogDescription>
        </DialogHeader>
        {/* Mount fresh on each open so the form re-seeds without an effect. */}
        {open && (
          <QuickAddForm
            seedDate={seedDate}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function defaultTimeOn(day: Date): Date {
  const d = new Date(day);
  d.setHours(9, 0, 0, 0); // 9:00am on the chosen day
  return d;
}

function toTimeInputValue(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function QuickAddForm({
  seedDate,
  onConfirm,
  onCancel,
}: {
  seedDate: Date | null;
  onConfirm: (title: string, isoString: string) => Promise<void> | void;
  onCancel: () => void;
}) {
  // useState initializers run once per mount — fresh each time the dialog opens.
  const [initial] = useState(() => defaultTimeOn(seedDate ?? new Date()));
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>(initial);
  const [dateOpen, setDateOpen] = useState(false);
  const [time, setTime] = useState(toTimeInputValue(initial));
  const [submitting, setSubmitting] = useState(false);

  const combined = useMemo(() => {
    if (!date) return null;
    const [hh, mm] = time.split(":").map((n) => parseInt(n, 10));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const out = new Date(date);
    out.setHours(hh, mm, 0, 0);
    return out;
  }, [date, time]);

  const canSubmit = !!combined && title.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!combined || !canSubmit) return;
    // Past-check lives in the handler (event handlers may read the clock).
    if (combined.getTime() < Date.now() - 30_000) {
      toast.error("Pick a future date and time");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(title.trim(), combined.toISOString());
      onCancel();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label
            htmlFor="qa-title"
            className="flex items-center gap-2 text-sm font-medium"
          >
            <SparklesIcon className="size-4" />
            Title / topic
          </Label>
          <Input
            id="qa-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. How to migrate to Postgres 16"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Label
              htmlFor="qa-date"
              className="flex items-center gap-2 text-sm font-medium"
            >
              <CalendarIcon className="size-4" />
              Date
            </Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="qa-date"
                  variant="outline"
                  className="w-full justify-between font-normal"
                >
                  {date ? format(date, "MMM d, yyyy") : "Pick a date"}
                  <ChevronDownIcon className="size-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto overflow-hidden p-0"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setDateOpen(false);
                  }}
                  disabled={(d) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return d < today;
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="w-32 space-y-2">
            <Label
              htmlFor="qa-time"
              className="flex items-center gap-2 text-sm font-medium"
            >
              <ClockIcon className="size-4" />
              Time
            </Label>
            <Input
              id="qa-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
            />
          </div>
        </div>

        {combined && (
          <p className="text-muted-foreground text-sm">
            Generates {format(combined, "EEEE, MMMM d 'at' h:mm a")}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {submitting ? "Adding…" : "Add to planner"}
        </Button>
      </DialogFooter>
    </>
  );
}
