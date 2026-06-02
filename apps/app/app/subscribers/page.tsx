"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DownloadIcon,
  MailIcon,
  MailQuestionIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { apiFetch } from "@/lib/api";

interface Subscriber {
  id: string;
  email: string;
  confirmedAt: string;
}

interface Payload {
  confirmed: Subscriber[];
  pendingCount: number;
  total: number;
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default function SubscribersPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchSubs = async () => {
    try {
      const res = await apiFetch(`/subscribers/me`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubs();
  }, []);

  const remove = async (id: string, email: string) => {
    const res = await apiFetch(`/subscribers/me/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(`Removed ${email}`);
      fetchSubs();
    } else {
      toast.error("Failed to remove subscriber");
    }
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.confirmed;
    return data.confirmed.filter((s) => s.email.toLowerCase().includes(q));
  }, [data, search]);

  const exportCsv = () => {
    if (!data || data.confirmed.length === 0) return;
    const lines = ["email,confirmed_at"];
    for (const s of data.confirmed) {
      lines.push(`${escapeCsv(s.email)},${s.confirmedAt}`);
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <SiteHeader title="Subscribers" />
      <div className="flex flex-1 flex-col">
        <div className="flex flex-col gap-6 p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Subscribers</h2>
              <p className="text-muted-foreground text-sm">
                People who get an email every time you publish a new post.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={!data || data.confirmed.length === 0}
            >
              <DownloadIcon className="mr-2 size-4" />
              Export CSV
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Confirmed
                </CardTitle>
                <UsersIcon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-semibold">
                    {data?.total ?? 0}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Pending confirmation
                </CardTitle>
                <MailQuestionIcon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-semibold">
                    {data?.pendingCount ?? 0}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                  Total reach
                </CardTitle>
                <MailIcon className="text-muted-foreground size-4" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-semibold">
                    {(data?.total ?? 0) + (data?.pendingCount ?? 0)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>Confirmed subscribers</CardTitle>
                  <CardDescription>
                    Search, export, or remove subscribers manually.
                  </CardDescription>
                </div>
                <div className="relative w-full max-w-xs">
                  <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by email"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : !data || data.confirmed.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center">
                  <p className="text-sm">
                    No subscribers yet. Share your blog to start collecting
                    them.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-muted-foreground py-12 text-center text-sm">
                  No subscribers match your filter.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Confirmed</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">
                          {sub.email}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(sub.confirmedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Remove"
                              >
                                <TrashIcon className="size-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove subscriber?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {sub.email} won&apos;t receive future posts.
                                  They can re-subscribe themselves later.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => remove(sub.id, sub.email)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
