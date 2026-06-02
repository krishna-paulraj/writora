"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { PlusIcon, RocketIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  CADENCE_LABELS,
  listContentPlans,
  relativeTime,
  type ContentPlanListItem,
  type PlanStatus,
} from "@/lib/content-plans";

const STATUS_BADGE: Record<
  PlanStatus,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  active: { label: "Active", variant: "default" },
  paused: { label: "Paused", variant: "secondary" },
  completed: { label: "Completed", variant: "outline" },
};

function planTotal(plan: ContentPlanListItem): number {
  return plan.totalTarget ?? plan._count.items;
}

export default function AutopilotPage() {
  const [plans, setPlans] = useState<ContentPlanListItem[] | null>(null);

  useEffect(() => {
    listContentPlans()
      .then(setPlans)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load plans");
        setPlans([]);
      });
  }, []);

  return (
    <>
      <SiteHeader title="Autopilot" />
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold">Autopilot</h2>
              <p className="text-muted-foreground text-sm">
                Set a topic and a cadence — Writora brainstorms a content plan
                and drafts the articles for you on schedule.
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/autopilot/new">
                <PlusIcon className="mr-1 size-4" />
                New plan
              </Link>
            </Button>
          </div>

          {plans === null ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 w-full rounded-xl" />
              ))}
            </div>
          ) : plans.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <RocketIcon />
                </EmptyMedia>
                <EmptyTitle>No content plans yet</EmptyTitle>
                <EmptyDescription>
                  Create your first autopilot to generate a steady stream of
                  SEO-targeted articles.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild>
                  <Link href="/autopilot/new">
                    <PlusIcon className="mr-1 size-4" />
                    New plan
                  </Link>
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => {
                const total = planTotal(plan);
                const badge = STATUS_BADGE[plan.status];
                const pct = total
                  ? Math.min(
                      100,
                      Math.round((plan.generatedCount / total) * 100),
                    )
                  : 0;
                return (
                  <Link key={plan.id} href={`/autopilot/${plan.id}`}>
                    <Card className="hover:border-primary/50 h-full transition-colors">
                      <CardHeader>
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="truncate">
                            {plan.title}
                          </CardTitle>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {plan.topic}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Progress value={pct} />
                        <div className="text-muted-foreground flex items-center justify-between text-xs">
                          <span>
                            {plan.generatedCount} / {total} articles
                          </span>
                          <span>
                            {plan.status === "active"
                              ? `Next ${relativeTime(plan.nextRunAt)}`
                              : plan.status === "paused"
                                ? "Paused"
                                : "Completed"}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">
                          {CADENCE_LABELS[plan.cadence]}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
