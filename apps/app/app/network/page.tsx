"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link2Icon, Loader2Icon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getMe, type Entitlements } from "@/lib/account";
import {
  getNetwork,
  updateNetwork,
  type NetworkMembership,
} from "@/lib/network";

interface Form {
  enabled: boolean;
  relPolicy: "dofollow" | "nofollow";
  maxOutboundPerPost: number;
  niche: string;
}

const DEFAULTS: Form = {
  enabled: true,
  relPolicy: "dofollow",
  maxOutboundPerPost: 3,
  niche: "",
};

export default function NetworkPage() {
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [form, setForm] = useState<Form>(DEFAULTS);
  const [joined, setJoined] = useState(false);
  const [stats, setStats] = useState({ inbound: 0, outbound: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([getMe(), getNetwork()])
      .then(([me, overview]) => {
        if (!active) return;
        setEnt(me.entitlements);
        setStats(overview.stats);
        const membership = overview.membership;
        if (membership) {
          setJoined(true);
          setForm({
            enabled: membership.enabled,
            relPolicy: membership.relPolicy,
            maxOutboundPerPost: membership.maxOutboundPerPost,
            niche: membership.niche ?? "",
          });
        }
      })
      .catch((e) =>
        toast.error(e instanceof Error ? e.message : "Failed to load"),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const save = async (patch: Partial<NetworkMembership>) => {
    setSaving(true);
    try {
      const updated = await updateNetwork(patch);
      setJoined(true);
      setForm({
        enabled: updated.enabled,
        relPolicy: updated.relPolicy,
        maxOutboundPerPost: updated.maxOutboundPerPost,
        niche: updated.niche ?? "",
      });
      toast.success("Network settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader title="Backlink Network" />
        <div className="text-muted-foreground py-24 text-center">
          Loading...
        </div>
      </>
    );
  }

  const entitled = ent?.limits.backlinkNetwork ?? false;

  return (
    <>
      <SiteHeader title="Backlink Network" />
      <div className="mx-auto w-full max-w-3xl space-y-6 p-4 lg:p-6">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Link2Icon className="size-5" />
            Backlink network
          </h2>
          <p className="text-muted-foreground text-sm">
            Opt this site into the cross-site network and your published
            articles will earn relevant contextual backlinks from other
            members&apos; sites — and link out to theirs. Matches are made by
            topical relevance; only published posts ever participate.
          </p>
        </div>

        {!entitled ? (
          <Card>
            <CardHeader>
              <CardTitle>Upgrade to join the network</CardTitle>
              <CardDescription>
                The backlink network is available on the Pro and Business plans.{" "}
                <a href="/billing" className="text-primary underline">
                  Upgrade
                </a>{" "}
                to enable it.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Backlinks earned</CardDescription>
                  <CardTitle className="text-3xl">{stats.inbound}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-xs">
                  Inbound links from other members&apos; posts.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Backlinks given</CardDescription>
                  <CardTitle className="text-3xl">{stats.outbound}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground text-xs">
                  Outbound links your posts provide to the network.
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Settings for this site</CardTitle>
                <CardDescription>
                  These apply to the currently selected site.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="enabled">Participate in the network</Label>
                    <p className="text-muted-foreground text-sm">
                      {joined
                        ? "This site is part of the network."
                        : "Turn on to join."}
                    </p>
                  </div>
                  <Switch
                    id="enabled"
                    checked={form.enabled}
                    disabled={saving}
                    onCheckedChange={(v) => save({ enabled: v })}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Link type (rel)</Label>
                  <NativeSelect
                    className="w-full max-w-xs"
                    value={form.relPolicy}
                    disabled={saving}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        relPolicy: e.target.value as "dofollow" | "nofollow",
                      }))
                    }
                  >
                    <NativeSelectOption value="dofollow">
                      Dofollow (passes authority)
                    </NativeSelectOption>
                    <NativeSelectOption value="nofollow">
                      Nofollow (safer)
                    </NativeSelectOption>
                  </NativeSelect>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="maxout">Max outbound links per post</Label>
                  <Input
                    id="maxout"
                    type="number"
                    min={0}
                    max={10}
                    className="max-w-[8rem]"
                    value={form.maxOutboundPerPost}
                    disabled={saving}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxOutboundPerPost: Number(e.target.value),
                      }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="niche">Niche / topic (optional)</Label>
                  <Input
                    id="niche"
                    placeholder="e.g. SaaS marketing, fitness, finance"
                    className="max-w-md"
                    value={form.niche}
                    disabled={saving}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, niche: e.target.value }))
                    }
                  />
                  <p className="text-muted-foreground text-xs">
                    Helps keep matched backlinks topically relevant.
                  </p>
                </div>

                <Button
                  onClick={() =>
                    save({
                      relPolicy: form.relPolicy,
                      maxOutboundPerPost: form.maxOutboundPerPost,
                      niche: form.niche.trim() || null,
                    })
                  }
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : null}
                  Save settings
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
