"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
  ExternalLinkIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  addPlanItem,
  CADENCE_LABELS,
  deleteContentPlan,
  deletePlanItem,
  getContentPlan,
  relativeTime,
  runContentPlan,
  updateContentPlan,
  type ContentPlanDetail,
  type ContentPlanItem,
  type ItemStatus,
} from "@/lib/content-plans";

// Poll while an article is in flight. Kept comfortably under the GET :id
// throttle; a failed poll only toasts (it never tears down the page).
const POLL_MS = 6000;

const ITEM_BADGE: Record<
  ItemStatus,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  planned: { label: "Planned", variant: "outline" },
  queued: { label: "Queued", variant: "secondary" },
  generating: { label: "Generating", variant: "secondary" },
  done: { label: "Done", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
  skipped: { label: "Skipped", variant: "outline" },
};

function isInFlight(item: ContentPlanItem): boolean {
  return item.status === "queued" || item.status === "generating";
}

export default function ContentPlanDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [plan, setPlan] = useState<ContentPlanDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newIdea, setNewIdea] = useState("");

  const refresh = useCallback(async () => {
    try {
      setPlan(await getContentPlan(id));
    } catch (e) {
      // Used by polling + mutations: a transient failure must NOT replace an
      // already-loaded page with an error screen. Surface it as a toast and
      // keep showing the last good state. (Initial-load failure is handled
      // separately below and does set the full-page error.)
      toast.error(e instanceof Error ? e.message : "Couldn't refresh plan");
    }
  }, [id]);

  // Initial load — setState lives in the promise callbacks, not the effect body.
  useEffect(() => {
    let active = true;
    getContentPlan(id)
      .then((p) => active && setPlan(p))
      .catch(
        (e) =>
          active &&
          setLoadError(e instanceof Error ? e.message : "Failed to load plan"),
      );
    return () => {
      active = false;
    };
  }, [id]);

  // Poll only while an article is actively being generated.
  const inFlight = plan?.items.some(isInFlight) ?? false;
  useEffect(() => {
    if (!inFlight) return;
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [inFlight, refresh]);

  const setStatus = async (status: "active" | "paused") => {
    if (!plan) return;
    setBusy(true);
    try {
      await updateContentPlan(plan.id, { status });
      await refresh();
      toast.success(
        status === "paused" ? "Autopilot paused" : "Autopilot resumed",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update plan");
    } finally {
      setBusy(false);
    }
  };

  const generateNext = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      await runContentPlan(plan.id);
      await refresh();
      toast.success("Generating the next article…");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start article");
    } finally {
      setBusy(false);
    }
  };

  const addIdea = async () => {
    if (!plan || !newIdea.trim()) return;
    setBusy(true);
    try {
      await addPlanItem(plan.id, { title: newIdea.trim() });
      setNewIdea("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add idea");
    } finally {
      setBusy(false);
    }
  };

  const removeIdea = async (itemId: string) => {
    if (!plan) return;
    try {
      await deletePlanItem(plan.id, itemId);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove idea");
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    try {
      await deleteContentPlan(plan.id);
      toast.success("Plan deleted");
      router.push("/autopilot");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete plan");
    }
  };

  if (loadError) {
    return (
      <>
        <SiteHeader title="Autopilot" />
        <div className="mx-auto w-full max-w-3xl p-6">
          <p className="text-destructive text-sm">{loadError}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/autopilot">
              <ArrowLeftIcon className="mr-1 size-4" />
              Back to plans
            </Link>
          </Button>
        </div>
      </>
    );
  }

  if (!plan) {
    return (
      <>
        <SiteHeader title="Autopilot" />
        <div className="mx-auto w-full max-w-3xl space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  const total = plan.totalTarget ?? plan.items.length;
  const plannedLeft = plan.items.filter((i) => i.status === "planned").length;
  const pct = total
    ? Math.min(100, Math.round((plan.generatedCount / total) * 100))
    : 0;

  return (
    <>
      <SiteHeader title="Autopilot" />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-6">
          <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
            <Link href="/autopilot">
              <ArrowLeftIcon className="mr-1 size-4" />
              All plans
            </Link>
          </Button>

          {/* Header + controls */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-semibold">{plan.title}</h2>
                <Badge
                  variant={
                    plan.status === "active"
                      ? "default"
                      : plan.status === "paused"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {plan.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm">{plan.topic}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {plan.status === "active" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setStatus("paused")}
                >
                  <PauseIcon className="mr-1 size-4" />
                  Pause
                </Button>
              )}
              {plan.status === "paused" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setStatus("active")}
                >
                  <PlayIcon className="mr-1 size-4" />
                  Resume
                </Button>
              )}
              <Button
                size="sm"
                disabled={busy || plan.status === "paused" || plannedLeft === 0}
                onClick={generateNext}
              >
                {busy ? (
                  <Spinner className="mr-1 size-4" />
                ) : (
                  <SparklesIcon className="mr-1 size-4" />
                )}
                Generate next
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" disabled={busy}>
                    <Trash2Icon className="size-4" />
                    <span className="sr-only">Delete plan</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The plan and its remaining ideas will be removed. Articles
                      already drafted are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Progress + meta */}
          <div className="space-y-3 rounded-lg border p-4">
            <Progress value={pct} />
            <div className="text-muted-foreground flex flex-wrap justify-between gap-2 text-xs">
              <span>
                {plan.generatedCount} / {total} articles generated
              </span>
              <span>
                {plan.status === "active"
                  ? `Next article ${relativeTime(plan.nextRunAt)}`
                  : plan.status === "paused"
                    ? "Paused"
                    : "Plan completed"}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">
                Cadence:{" "}
                <span className="text-foreground">
                  {CADENCE_LABELS[plan.cadence]}
                </span>
              </span>
              <span className="text-muted-foreground">
                Auto-publish:{" "}
                <span className="text-foreground">
                  {plan.autoPublish ? "On" : "Off (drafts)"}
                </span>
              </span>
              {plan.category && (
                <span className="text-muted-foreground">
                  Category:{" "}
                  <span className="text-foreground">{plan.category}</span>
                </span>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Article queue</h3>
            <ul className="divide-y rounded-lg border">
              {plan.items.map((item) => {
                const badge = ITEM_BADGE[item.status];
                const blogId = item.job?.blogId;
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 p-3 text-sm"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={badge.variant} className="shrink-0">
                          {badge.label}
                        </Badge>
                        <span className="truncate font-medium">
                          {item.title}
                        </span>
                      </div>
                      {item.targetKeyword && (
                        <p className="text-muted-foreground text-xs">
                          Target: {item.targetKeyword}
                        </p>
                      )}
                      {item.status === "generating" && item.job && (
                        <Progress
                          value={item.job.progress}
                          className="mt-1 h-1"
                        />
                      )}
                      {item.status === "failed" && item.job?.error && (
                        <p className="text-destructive text-xs">
                          {item.job.error}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.status === "done" && blogId && (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/blogs/${blogId}/edit`}>
                            Open draft
                            <ExternalLinkIcon className="ml-1 size-3" />
                          </Link>
                        </Button>
                      )}
                      {isInFlight(item) && !item.job && (
                        <Spinner className="size-4" />
                      )}
                      {item.status === "planned" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeIdea(item.id)}
                        >
                          <Trash2Icon className="size-4" />
                          <span className="sr-only">Remove idea</span>
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Add idea */}
            <div className="flex gap-2 pt-2">
              <Input
                value={newIdea}
                onChange={(e) => setNewIdea(e.target.value)}
                onKeyDown={(e) => {
                  // Match the Add button's disabled guard so a quick double
                  // Enter can't post the same idea twice.
                  if (e.key === "Enter" && !busy && newIdea.trim()) {
                    e.preventDefault();
                    void addIdea();
                  }
                }}
                placeholder="Add another article idea…"
              />
              <Button
                variant="outline"
                disabled={busy || !newIdea.trim()}
                onClick={addIdea}
              >
                <PlusIcon className="mr-1 size-4" />
                Add
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
