"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  Loader2Icon,
  PlusIcon,
  SendIcon,
  TrashIcon,
  XCircleIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  addTarget,
  listTargets,
  PLATFORM_LABELS,
  removeTarget,
  testTarget,
  updateTarget,
  type Platform,
  type PublishTarget,
} from "@/lib/publish";

export default function DestinationsPage() {
  const [targets, setTargets] = useState<PublishTarget[] | null>(null);
  const [platform, setPlatform] = useState<Platform>("wordpress");
  const [name, setName] = useState("");
  const [wpSiteUrl, setWpSiteUrl] = useState("");
  const [wpToken, setWpToken] = useState("");
  const [devtoApiKey, setDevtoApiKey] = useState("");
  const [xApiKey, setXApiKey] = useState("");
  const [xApiSecret, setXApiSecret] = useState("");
  const [xAccessToken, setXAccessToken] = useState("");
  const [xAccessTokenSecret, setXAccessTokenSecret] = useState("");
  const [autoPublish, setAutoPublish] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () =>
    listTargets()
      .then(setTargets)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load");
        setTargets([]);
      });

  useEffect(() => {
    void refresh();
  }, []);

  const resetForm = () => {
    setName("");
    setWpSiteUrl("");
    setWpToken("");
    setDevtoApiKey("");
    setXApiKey("");
    setXApiSecret("");
    setXAccessToken("");
    setXAccessTokenSecret("");
    setAutoPublish(false);
  };

  const xFilled =
    xApiKey.trim().length > 0 &&
    xApiSecret.trim().length > 0 &&
    xAccessToken.trim().length > 0 &&
    xAccessTokenSecret.trim().length > 0;

  const canAdd =
    name.trim().length > 0 &&
    (platform === "wordpress"
      ? wpSiteUrl.trim().length > 0 && wpToken.trim().length > 0
      : platform === "x"
        ? xFilled
        : devtoApiKey.trim().length > 0);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await addTarget({
        platform,
        name: name.trim(),
        autoPublish,
        credentials:
          platform === "wordpress"
            ? { siteUrl: wpSiteUrl.trim(), token: wpToken.trim() }
            : platform === "x"
              ? {
                  apiKey: xApiKey.trim(),
                  apiSecret: xApiSecret.trim(),
                  accessToken: xAccessToken.trim(),
                  accessTokenSecret: xAccessTokenSecret.trim(),
                }
              : { apiKey: devtoApiKey.trim() },
      });
      toast.success("Destination connected");
      resetForm();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add destination");
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (
    t: PublishTarget,
    field: "enabled" | "autoPublish",
    value: boolean,
  ) => {
    // Optimistic flip; revert on failure.
    setTargets((prev) =>
      prev
        ? prev.map((x) => (x.id === t.id ? { ...x, [field]: value } : x))
        : prev,
    );
    try {
      await updateTarget(t.id, { [field]: value });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
      await refresh();
    }
  };

  const handleTest = async (t: PublishTarget) => {
    setBusyId(t.id);
    try {
      const result = await testTarget(t.id);
      if (result.ok) {
        toast.success(`Connected${result.info ? ` · ${result.info}` : ""}`);
      } else {
        toast.error(`Test failed${result.info ? `: ${result.info}` : ""}`);
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeTarget(id);
      toast.success("Destination removed");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  return (
    <>
      <SiteHeader title="Destinations" />
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 lg:p-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">Publishing destinations</h2>
          <p className="text-muted-foreground text-sm">
            Cross-post your published articles to WordPress, Dev.to, and X
            (Twitter). Turn on auto-publish to push each new post automatically,
            or publish on demand from the Blogs list. Blog cross-posts link
            their canonical URL back to the Writora original; X posts an
            AI-written tweet with the link.
          </p>
        </div>

        {/* Add destination */}
        <Card>
          <CardHeader>
            <CardTitle>Connect a destination</CardTitle>
            <CardDescription>
              {platform === "wordpress"
                ? "Install the Writora Connector plugin on your WordPress site, then paste the Site URL and token from Settings → Writora Connector."
                : platform === "x"
                  ? "Create an app at developer.x.com with Read and Write permissions, then paste its API key/secret and your access token/secret. Each new post becomes an AI-written tweet linking back to the original."
                  : "Generate an API key at dev.to → Settings → Extensions → DEV API Keys."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <NativeSelect
                  id="platform"
                  className="w-full"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                >
                  <NativeSelectOption value="wordpress">
                    WordPress
                  </NativeSelectOption>
                  <NativeSelectOption value="devto">Dev.to</NativeSelectOption>
                  <NativeSelectOption value="x">X (Twitter)</NativeSelectOption>
                </NativeSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Label</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My blog"
                />
              </div>
            </div>

            {platform === "wordpress" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="siteUrl">Site URL</Label>
                  <Input
                    id="siteUrl"
                    value={wpSiteUrl}
                    onChange={(e) => setWpSiteUrl(e.target.value)}
                    placeholder="https://yourblog.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="token">Connection token</Label>
                  <Input
                    id="token"
                    type="password"
                    value={wpToken}
                    onChange={(e) => setWpToken(e.target.value)}
                    placeholder="from the Writora Connector plugin"
                  />
                </div>
              </div>
            ) : platform === "x" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="xApiKey">API key</Label>
                  <Input
                    id="xApiKey"
                    type="password"
                    value={xApiKey}
                    onChange={(e) => setXApiKey(e.target.value)}
                    placeholder="consumer API key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="xApiSecret">API key secret</Label>
                  <Input
                    id="xApiSecret"
                    type="password"
                    value={xApiSecret}
                    onChange={(e) => setXApiSecret(e.target.value)}
                    placeholder="consumer API secret"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="xAccessToken">Access token</Label>
                  <Input
                    id="xAccessToken"
                    type="password"
                    value={xAccessToken}
                    onChange={(e) => setXAccessToken(e.target.value)}
                    placeholder="user access token"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="xAccessTokenSecret">
                    Access token secret
                  </Label>
                  <Input
                    id="xAccessTokenSecret"
                    type="password"
                    value={xAccessTokenSecret}
                    onChange={(e) => setXAccessTokenSecret(e.target.value)}
                    placeholder="user access token secret"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="apiKey">API key</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={devtoApiKey}
                  onChange={(e) => setDevtoApiKey(e.target.value)}
                  placeholder="dev.to API key"
                />
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="auto">Auto-publish on publish</Label>
                <p className="text-muted-foreground text-xs">
                  Automatically cross-post here whenever you publish a post.
                </p>
              </div>
              <Switch
                id="auto"
                checked={autoPublish}
                onCheckedChange={setAutoPublish}
              />
            </div>

            <Button onClick={handleAdd} disabled={!canAdd || adding}>
              <PlusIcon className="mr-2 size-4" />
              {adding ? "Connecting…" : "Connect destination"}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Connected destinations */}
        {targets === null ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : targets.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            No destinations connected yet.
          </p>
        ) : (
          <div className="space-y-3">
            {targets.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-start justify-between gap-4 rounded-lg border p-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    <Badge variant="secondary">
                      {PLATFORM_LABELS[t.platform]}
                    </Badge>
                    {t.lastStatus === "ok" && (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2Icon className="size-3" />
                        OK
                      </Badge>
                    )}
                    {t.lastStatus === "error" && (
                      <Badge
                        variant="destructive"
                        className="gap-1"
                        title={t.lastError ?? undefined}
                      >
                        <XCircleIcon className="size-3" />
                        Error
                      </Badge>
                    )}
                  </div>
                  {t.lastError && (
                    <p className="text-destructive truncate text-xs">
                      {t.lastError}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={t.enabled}
                        onCheckedChange={(v) => toggle(t, "enabled", v)}
                      />
                      Enabled
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={t.autoPublish}
                        onCheckedChange={(v) => toggle(t, "autoPublish", v)}
                      />
                      Auto-publish
                    </label>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(t)}
                    disabled={busyId === t.id}
                  >
                    {busyId === t.id ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      "Test"
                    )}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" title="Remove">
                        <TrashIcon className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove destination?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Future posts won&apos;t cross-post to {t.name}. Posts
                          already published there stay put.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRemove(t.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-muted-foreground flex items-center gap-2 border-t pt-4 text-xs">
          <SendIcon className="size-3.5" />
          Publish a specific post on demand from the Blogs list → “Publish to…”.
        </div>
      </div>
    </>
  );
}
