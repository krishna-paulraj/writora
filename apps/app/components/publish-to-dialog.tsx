"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2Icon,
  ExternalLinkIcon,
  Loader2Icon,
  SendIcon,
  XCircleIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  listBlogRecords,
  listTargets,
  PLATFORM_LABELS,
  publishBlog,
  type PublishRecord,
  type PublishTarget,
} from "@/lib/publish";

const ALL = "__all__";

export function PublishToDialog({
  blogId,
  blogTitle,
  children,
}: {
  blogId: string;
  blogTitle: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<PublishTarget[] | null>(null);
  const [records, setRecords] = useState<Record<string, PublishRecord>>({});
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [ts, recs] = await Promise.all([
        listTargets(),
        listBlogRecords(blogId),
      ]);
      setTargets(ts);
      setRecords(Object.fromEntries(recs.map((r) => [r.targetId, r])));
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load destinations",
      );
      setTargets([]);
    }
  };

  const onOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      setTargets(null);
      void load();
    }
  };

  const publish = async (targetId?: string) => {
    setPublishingId(targetId ?? ALL);
    try {
      const recs = await publishBlog(blogId, targetId ? [targetId] : undefined);
      setRecords((prev) => {
        const next = { ...prev };
        for (const r of recs) next[r.targetId] = r;
        return next;
      });
      const failed = recs.filter((r) => r.status === "failed");
      if (failed.length) toast.error(`${failed.length} destination(s) failed`);
      else toast.success("Published");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishingId(null);
    }
  };

  const enabled = (targets ?? []).filter((t) => t.enabled);
  const busy = publishingId !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish to…</DialogTitle>
          <DialogDescription className="truncate">
            {blogTitle}
          </DialogDescription>
        </DialogHeader>

        {targets === null ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            Loading destinations…
          </p>
        ) : enabled.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No enabled destinations. Connect one on the Destinations page.
          </p>
        ) : (
          <div className="space-y-2">
            {enabled.map((t) => {
              const rec = records[t.id];
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {t.name}
                      </span>
                      <Badge variant="secondary">
                        {PLATFORM_LABELS[t.platform]}
                      </Badge>
                    </div>
                    {rec?.status === "success" && rec.externalUrl && (
                      <a
                        href={rec.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 text-xs"
                      >
                        <CheckCircle2Icon className="size-3" /> View
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                    {rec?.status === "failed" && (
                      <span
                        className="text-destructive inline-flex items-center gap-1 text-xs"
                        title={rec.error ?? undefined}
                      >
                        <XCircleIcon className="size-3" />{" "}
                        {rec.error ?? "Failed"}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => publish(t.id)}
                  >
                    {publishingId === t.id ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : rec?.status === "success" ? (
                      "Re-publish"
                    ) : (
                      "Publish"
                    )}
                  </Button>
                </div>
              );
            })}
            <Button
              className="w-full"
              disabled={busy}
              onClick={() => publish()}
            >
              <SendIcon className="mr-2 size-4" />
              {publishingId === ALL ? "Publishing…" : "Publish to all enabled"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
