"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  ClockIcon,
  EyeIcon,
  FileTextIcon,
  MinusIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface DashboardStats {
  totalBlogs: number;
  publishedBlogs: number;
  totalViews: number;
  viewsThisWeek: number;
  viewsTrend: number;
  topPosts: Array<{ id: string; title: string; slug: string; views: number }>;
  recentBlogs: Array<{
    id: string;
    title: string;
    slug: string;
    published: boolean;
    createdAt: string;
    views: number;
  }>;
  chartData: Array<{ date: string; views: number }>;
}

interface BlogRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  createdAt: string;
  readTime: number;
  views: number;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [blogs, setBlogs] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/analytics/dashboard`, { credentials: "include" }).then(
        (r) => r.json(),
      ),
      fetch(`${API_URL}/analytics/blogs`, { credentials: "include" }).then(
        (r) => r.json(),
      ),
    ])
      .then(([s, b]) => {
        setStats(s);
        setBlogs(b);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const avgReadTime = useMemo(() => {
    if (blogs.length === 0) return 0;
    return Math.round(
      blogs.reduce((sum, b) => sum + b.readTime, 0) / blogs.length,
    );
  }, [blogs]);

  if (loading || !stats) {
    return (
      <>
        <SiteHeader title="Analytics" />
        <div className="flex flex-col gap-6 p-4 lg:p-6">
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    );
  }

  const trendIcon =
    stats.viewsTrend > 0
      ? ArrowUpRightIcon
      : stats.viewsTrend < 0
        ? ArrowDownRightIcon
        : MinusIcon;
  const TrendIcon = trendIcon;
  const trendColor =
    stats.viewsTrend > 0
      ? "text-emerald-600 dark:text-emerald-400"
      : stats.viewsTrend < 0
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted-foreground";

  return (
    <>
      <SiteHeader title="Analytics" />
      <div className="flex flex-col gap-6 p-4 lg:p-6">
        {/* Top stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Total views
              </CardTitle>
              <EyeIcon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {stats.totalViews.toLocaleString()}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">all time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                This week
              </CardTitle>
              <TrendIcon className={`size-4 ${trendColor}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {stats.viewsThisWeek.toLocaleString()}
              </div>
              <p className={`mt-1 text-xs ${trendColor}`}>
                {stats.viewsTrend > 0 ? "+" : ""}
                {stats.viewsTrend}% vs last week
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Published posts
              </CardTitle>
              <FileTextIcon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {stats.publishedBlogs}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                of {stats.totalBlogs} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                Avg. read time
              </CardTitle>
              <ClockIcon className="text-muted-foreground size-4" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">
                {avgReadTime}
                <span className="text-muted-foreground ml-1 text-lg">min</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">per post</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily views chart */}
        <Card>
          <CardHeader>
            <CardTitle>Views — last 30 days</CardTitle>
            <CardDescription>Daily breakdown across all posts</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.chartData.every((d) => d.views === 0) ? (
              <div className="text-muted-foreground flex h-72 items-center justify-center text-sm">
                No views yet. Share your posts to start seeing traffic.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats.chartData.map((d) => ({
                      ...d,
                      label: formatShortDate(d.date),
                    }))}
                    margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="viewsGradient"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--primary)"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--primary)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      interval="preserveStartEnd"
                      minTickGap={32}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "var(--foreground)" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#viewsGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top posts + recent */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top posts</CardTitle>
              <CardDescription>Most-viewed posts of all time</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.topPosts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No data yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.topPosts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-[300px] truncate">
                          <Link
                            href={`/blogs/${p.id}/edit`}
                            className="hover:underline"
                          >
                            {p.title}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.views.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Your latest posts</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.recentBlogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No posts yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recentBlogs.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-[240px] truncate">
                          <Link
                            href={`/blogs/${p.id}/edit`}
                            className="hover:underline"
                          >
                            {p.title}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={p.published ? "default" : "outline"}>
                            {p.published ? "Live" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {p.views.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Full per-post table */}
        <Card>
          <CardHeader>
            <CardTitle>All posts</CardTitle>
            <CardDescription>Every post with its stats</CardDescription>
          </CardHeader>
          <CardContent>
            {blogs.length === 0 ? (
              <p className="text-muted-foreground text-sm">No posts yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blogs.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="max-w-[280px] truncate">
                        <Link
                          href={`/blogs/${b.id}/edit`}
                          className="hover:underline"
                        >
                          {b.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{b.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.published ? "default" : "outline"}>
                          {b.published ? "Live" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.views.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
