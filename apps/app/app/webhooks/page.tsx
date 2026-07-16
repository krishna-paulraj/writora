"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2Icon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  TrashIcon,
  WebhookIcon,
  XCircleIcon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface Inbound {
  url: string;
  token: string;
}

interface Endpoint {
  id: string;
  url: string;
  description: string | null;
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastStatus: number | null;
  lastError: string | null;
  createdAt: string;
}

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(label));
}

export default function WebhooksPage() {
  const [inbound, setInbound] = useState<Inbound | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealToken, setRevealToken] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Promise-chain style so the effect below passes the set-state-in-effect
  // lint rule (setState only ever runs in .then callbacks).
  const fetchAll = () =>
    Promise.all([
      fetch(`${API_URL}/webhooks/inbound`, { credentials: "include" }),
      fetch(`${API_URL}/webhooks/outbound`, { credentials: "include" }),
    ])
      .then(([inRes, outRes]) =>
        Promise.all([
          inRes.ok ? inRes.json().then(setInbound) : undefined,
          outRes.ok ? outRes.json().then(setEndpoints) : undefined,
        ]),
      )
      .catch(() => undefined)
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchAll();
  }, []);

  const regenerate = async () => {
    if (
      !confirm(
        "Regenerate the inbound token? Existing integrations will stop working.",
      )
    ) {
      return;
    }
    const res = await fetch(`${API_URL}/webhooks/inbound/regenerate`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      setInbound((prev) => (prev ? { ...prev, token: data.token } : null));
      setRevealToken(true);
      toast.success("Token regenerated");
    } else {
      toast.error("Failed to regenerate");
    }
  };

  const addEndpoint = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const res = await fetch(`${API_URL}/webhooks/outbound`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: newUrl.trim(),
          description: newDescription.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.message || "Failed to add endpoint");
        return;
      }
      const created = await res.json();
      toast.success("Endpoint added — your signing secret is shown once below");
      // Surface the secret to the user
      alert(
        `Signing secret for ${created.url}:\n\n${created.secret}\n\nSave this — it won't be shown again.`,
      );
      setNewUrl("");
      setNewDescription("");
      await fetchAll();
    } finally {
      setAdding(false);
    }
  };

  const removeEndpoint = async (id: string) => {
    const res = await fetch(`${API_URL}/webhooks/outbound/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      toast.success("Endpoint removed");
      fetchAll();
    } else {
      toast.error("Failed to remove");
    }
  };

  const testEndpoint = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch(`${API_URL}/webhooks/outbound/${id}/test`, {
        method: "POST",
        credentials: "include",
      });
      const result = await res.json().catch(() => ({}));
      if (result.ok) {
        toast.success(`Test OK · HTTP ${result.status}`);
      } else {
        toast.error(`Test failed: ${result.error || "no response"}`);
      }
      fetchAll();
    } finally {
      setTestingId(null);
    }
  };

  if (loading) {
    return (
      <>
        <SiteHeader title="Webhooks" />
        <div className="p-4 lg:p-6">
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    );
  }

  const curlExample = inbound
    ? `curl -X POST ${inbound.url} \\
  -H 'Authorization: Bearer ${revealToken ? inbound.token : "YOUR_TOKEN"}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "title": "Hello from a webhook",
    "category": "general",
    "content": "<p>Posted via the inbound webhook.</p>",
    "publish": true
  }'`
    : "";

  return (
    <>
      <SiteHeader title="Webhooks" />
      <div className="mx-auto max-w-4xl space-y-6 p-4 lg:p-6">
        {/* --- Inbound --- */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ZapIcon className="text-primary size-5" />
              <CardTitle>Inbound webhook</CardTitle>
            </div>
            <CardDescription>
              Let external systems (Zapier, n8n, AI agents, your own scripts)
              create blog posts by POSTing JSON to this URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Endpoint URL</Label>
              <div className="flex gap-2">
                <Input
                  value={inbound?.url ?? ""}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => inbound && copy(inbound.url, "URL copied")}
                >
                  <CopyIcon className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bearer token</Label>
              <div className="flex gap-2">
                <Input
                  value={revealToken ? inbound?.token : "•".repeat(40)}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setRevealToken((v) => !v)}
                  title={revealToken ? "Hide" : "Reveal"}
                >
                  {revealToken ? (
                    <EyeOffIcon className="size-4" />
                  ) : (
                    <EyeIcon className="size-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => inbound && copy(inbound.token, "Token copied")}
                >
                  <CopyIcon className="size-4" />
                </Button>
                <Button variant="outline" onClick={regenerate}>
                  <RefreshCwIcon className="mr-2 size-4" />
                  Regenerate
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">
                Treat this like a password. Send it as{" "}
                <code className="font-mono">Authorization: Bearer ...</code>.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Example</Label>
              <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">
                {curlExample}
              </pre>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(curlExample, "Snippet copied")}
              >
                <CopyIcon className="mr-2 size-3.5" />
                Copy snippet
              </Button>
            </div>

            <div className="text-muted-foreground space-y-1 text-xs">
              <p className="font-medium">Payload fields:</p>
              <ul className="list-inside list-disc space-y-0.5">
                <li>
                  <code>title</code>, <code>content</code>,{" "}
                  <code>category</code> — required
                </li>
                <li>
                  <code>slug</code> — optional, auto-derived from title
                </li>
                <li>
                  <code>description</code>, <code>imageUrl</code>,{" "}
                  <code>featured</code> — optional
                </li>
                <li>
                  <code>publish: true</code> — go live immediately (also
                  triggers newsletter)
                </li>
                <li>
                  <code>scheduledAt: &quot;2026-01-01T10:00:00Z&quot;</code> —
                  schedule for later
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* --- Outbound --- */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <WebhookIcon className="text-primary size-5" />
              <CardTitle>Outbound webhooks</CardTitle>
            </div>
            <CardDescription>
              We&apos;ll POST a signed JSON payload to these URLs whenever one
              of your blogs is published. Useful for Slack/Discord
              notifications, syndication, or piping into your own pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                placeholder="https://your.app/webhooks/writora"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
              />
              <Input
                placeholder="Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
              />
              <Button onClick={addEndpoint} disabled={adding || !newUrl.trim()}>
                <PlusIcon className="mr-2 size-4" />
                {adding ? "Adding…" : "Add"}
              </Button>
            </div>

            <Separator />

            {endpoints.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No endpoints yet. Add one above to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {endpoints.map((ep) => (
                  <div
                    key={ep.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm break-all">
                          {ep.url}
                        </code>
                        <a
                          href={ep.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLinkIcon className="size-3.5" />
                        </a>
                      </div>
                      {ep.description && (
                        <p className="text-muted-foreground text-xs">
                          {ep.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {ep.lastDeliveryAt ? (
                          ep.lastError ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircleIcon className="size-3" />
                              Failed · HTTP {ep.lastStatus || "—"}
                            </Badge>
                          ) : (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2Icon className="size-3" />
                              OK · HTTP {ep.lastStatus}
                            </Badge>
                          )
                        ) : (
                          <Badge variant="secondary">Never fired</Badge>
                        )}
                        {ep.lastDeliveryAt && (
                          <span className="text-muted-foreground">
                            {new Date(ep.lastDeliveryAt).toLocaleString()}
                          </span>
                        )}
                        {ep.lastError && (
                          <span
                            className="text-destructive truncate"
                            title={ep.lastError}
                          >
                            · {ep.lastError}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => testEndpoint(ep.id)}
                        disabled={testingId === ep.id}
                      >
                        {testingId === ep.id ? (
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
                            <AlertDialogTitle>
                              Remove endpoint?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Future blog publishes won&apos;t notify this URL.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeEndpoint(ep.id)}
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

            <div className="text-muted-foreground space-y-1 border-t pt-3 text-xs">
              <p className="font-medium">Verify signatures (receiver-side):</p>
              <p>
                Every POST includes{" "}
                <code className="font-mono">
                  X-Writora-Signature: t=&lt;unix&gt;,v1=&lt;hex&gt;
                </code>
                . Recompute{" "}
                <code>
                  HMAC-SHA256(&lt;unix&gt;.&lt;raw-body&gt;,
                  &lt;your-secret&gt;)
                </code>{" "}
                and compare in constant time.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
