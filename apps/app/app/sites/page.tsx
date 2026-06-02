"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";
import { GlobeIcon, PlusIcon, StarIcon, TrashIcon } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
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
  createSite,
  deleteSite,
  listSites,
  setSiteDomain,
  type Site,
} from "@/lib/sites";
import { getMe, type Entitlements } from "@/lib/account";

function SitesInner() {
  const params = useSearchParams();
  const [sites, setSites] = useState<Site[] | null>(null);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [showNew, setShowNew] = useState(params.get("new") === "1");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [creating, setCreating] = useState(false);
  const [domainDraft, setDomainDraft] = useState<Record<string, string>>({});

  const refresh = () =>
    Promise.all([listSites(), getMe()])
      .then(([s, me]) => {
        setSites(s);
        setEnt(me.entitlements);
        setDomainDraft(
          Object.fromEntries(s.map((x) => [x.id, x.customDomain ?? ""])),
        );
      })
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load sites");
        setSites([]);
      });

  useEffect(() => {
    void refresh();
  }, []);

  const atLimit = !!ent && !!sites && sites.length >= ent.limits.sites;

  const handleCreate = async () => {
    setCreating(true);
    try {
      await createSite({ name: name.trim(), slug: slug.trim() });
      toast.success("Site created");
      setName("");
      setSlug("");
      setShowNew(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create site");
    } finally {
      setCreating(false);
    }
  };

  const handleDomain = async (site: Site) => {
    const next = (domainDraft[site.id] ?? "").trim();
    try {
      await setSiteDomain(site.id, next || null);
      toast.success(next ? "Custom domain saved" : "Custom domain cleared");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to set domain");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSite(id);
      toast.success("Site deleted");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete site");
    }
  };

  return (
    <>
      <SiteHeader title="Sites" />
      <div className="mx-auto w-full max-w-4xl space-y-6 p-4 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold">Your sites</h2>
            <p className="text-muted-foreground text-sm">
              Each site is a separate publication with its own posts,
              subscribers, theme, and domain. Switch the active site from the
              sidebar.
            </p>
          </div>
          <Button
            className="shrink-0"
            disabled={atLimit}
            onClick={() => setShowNew((v) => !v)}
            title={atLimit ? "Upgrade to add more sites" : undefined}
          >
            <PlusIcon className="mr-1 size-4" />
            New site
          </Button>
        </div>

        {atLimit && (
          <p className="text-muted-foreground text-sm">
            You&apos;re using {sites?.length}/{ent?.limits.sites} sites on the{" "}
            <span className="capitalize">{ent?.plan}</span> plan.{" "}
            <a href="/billing" className="text-primary underline">
              Upgrade
            </a>{" "}
            for more.
          </p>
        )}

        {showNew && !atLimit && (
          <Card>
            <CardHeader>
              <CardTitle>New site</CardTitle>
              <CardDescription>
                The slug is the site&apos;s public address at /s/&lt;slug&gt;.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My second blog"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="my-second-blog"
                  />
                </div>
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating || !name.trim() || !slug.trim()}
              >
                {creating ? "Creating…" : "Create site"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Separator />

        {sites === null ? (
          <Skeleton className="h-40 w-full rounded-xl" />
        ) : (
          <div className="space-y-3">
            {sites.map((site) => (
              <div key={site.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <GlobeIcon className="text-muted-foreground size-4" />
                    <span className="font-medium">{site.name}</span>
                    {site.isPrimary ? (
                      <Badge variant="secondary" className="gap-1">
                        <StarIcon className="size-3" />
                        Primary
                      </Badge>
                    ) : (
                      <Badge variant="outline">/s/{site.slug}</Badge>
                    )}
                  </div>
                  {!site.isPrimary && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" title="Delete site">
                          <TrashIcon className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this site?</AlertDialogTitle>
                          <AlertDialogDescription>
                            All of {site.name}&apos;s posts, subscribers, and
                            categories will be permanently removed.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(site.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">
                      Custom domain{" "}
                      {!ent?.limits.customDomain && (
                        <span className="text-muted-foreground">
                          (Pro and above)
                        </span>
                      )}
                    </Label>
                    <Input
                      value={domainDraft[site.id] ?? ""}
                      onChange={(e) =>
                        setDomainDraft((d) => ({
                          ...d,
                          [site.id]: e.target.value,
                        }))
                      }
                      placeholder="blog.example.com"
                      disabled={!ent?.limits.customDomain}
                    />
                  </div>
                  <Button
                    variant="outline"
                    disabled={!ent?.limits.customDomain}
                    onClick={() => handleDomain(site)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function SitesPage() {
  return (
    <Suspense fallback={null}>
      <SitesInner />
    </Suspense>
  );
}
