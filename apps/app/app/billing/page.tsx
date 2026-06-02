"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMe, type Entitlements, type PlanName } from "@/lib/account";
import { openBillingPortal, startCheckout } from "@/lib/billing";

interface PlanCard {
  id: PlanName;
  name: string;
  price: string;
  features: string[];
}

const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    features: ["1 site", "5 AI articles / month", "Manual publishing"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19/mo",
    features: [
      "5 sites",
      "100 AI articles / month",
      "Autopilot content plans",
      "Publish to WordPress & Dev.to",
      "Custom domains",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "$49/mo",
    features: [
      "25 sites",
      "1,000 AI articles / month",
      "Everything in Pro",
      "Higher limits",
    ],
  },
];

function BillingInner() {
  const params = useSearchParams();
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((me) => setEnt(me.entitlements))
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Failed to load billing"),
      );
  }, []);

  useEffect(() => {
    const status = params.get("status");
    if (status === "success") {
      toast.success("Subscription updated — thank you!");
    } else if (status === "cancelled") {
      toast("Checkout cancelled");
    }
  }, [params]);

  const upgrade = async (plan: Exclude<PlanName, "free">) => {
    setBusy(plan);
    try {
      await startCheckout(plan);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start checkout");
      setBusy(null);
    }
  };

  const manage = async () => {
    setBusy("portal");
    try {
      await openBillingPortal();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open portal");
      setBusy(null);
    }
  };

  const current = ent?.plan ?? "free";

  return (
    <>
      <SiteHeader title="Billing" />
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 lg:p-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Plans &amp; billing</h2>
          <p className="text-muted-foreground text-sm">
            Upgrade to unlock more sites, AI generations, autopilot, and
            publishing destinations.
          </p>
        </div>

        {ent === null ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
            <div>
              <span className="text-muted-foreground">Current plan: </span>
              <span className="font-medium capitalize">{ent.plan}</span>
              {ent.status && ent.status !== "active" && (
                <Badge variant="outline" className="ml-2 capitalize">
                  {ent.status.replace("_", " ")}
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground">
              {ent.usage.aiArticlesThisMonth}/{ent.limits.aiArticlesPerMonth} AI
              articles · {ent.usage.sites}/{ent.limits.sites} sites ·{" "}
              {ent.usage.destinations}/{ent.limits.destinations} destinations
            </div>
            {ent.plan !== "free" && (
              <Button
                variant="outline"
                size="sm"
                onClick={manage}
                disabled={busy !== null}
              >
                {busy === "portal" ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  "Manage subscription"
                )}
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = p.id === current;
            return (
              <Card
                key={p.id}
                className={isCurrent ? "border-primary" : undefined}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{p.name}</CardTitle>
                    {isCurrent && <Badge>Current</Badge>}
                  </div>
                  <CardDescription className="text-foreground text-2xl font-semibold">
                    {p.price}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <CheckIcon className="text-primary size-4 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {p.id !== "free" && !isCurrent && (
                    <Button
                      className="w-full"
                      onClick={() => upgrade(p.id as Exclude<PlanName, "free">)}
                      disabled={busy !== null}
                    >
                      {busy === p.id ? (
                        <Loader2Icon className="size-4 animate-spin" />
                      ) : (
                        `Upgrade to ${p.name}`
                      )}
                    </Button>
                  )}
                  {isCurrent && (
                    <Button className="w-full" variant="outline" disabled>
                      Your plan
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingInner />
    </Suspense>
  );
}
