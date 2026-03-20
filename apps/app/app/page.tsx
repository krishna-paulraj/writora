"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  TrendingUpIcon,
  TrendingDownIcon,
  FileTextIcon,
  EyeIcon,
  BarChart3Icon,
  PenLineIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const chartConfig = {
  views: {
    label: "Views",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

interface DashboardData {
  totalBlogs: number;
  publishedBlogs: number;
  totalViews: number;
  viewsThisWeek: number;
  viewsTrend: number;
  topPosts: { id: string; title: string; slug: string; views: number }[];
  recentBlogs: {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    createdAt: string;
    views: number;
  }[];
  chartData: { date: string; views: number }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("30d");

  useEffect(() => {
    fetch(`${API_URL}/analytics/dashboard`, { credentials: "include" })
      .then((res) => res.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <SiteHeader title="Dashboard" />
        <div className="text-muted-foreground py-24 text-center">
          Loading...
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <SiteHeader title="Dashboard" />
        <div className="text-muted-foreground py-24 text-center">
          Failed to load dashboard
        </div>
      </>
    );
  }

  const filteredChartData = data.chartData.filter((item) => {
    const date = new Date(item.date);
    const now = new Date();
    const daysToSubtract =
      timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return date >= startDate;
  });

  return (
    <>
      <SiteHeader title="Dashboard" />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Views</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {data.totalViews.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  {data.viewsTrend >= 0 ? (
                    <TrendingUpIcon className="size-3" />
                  ) : (
                    <TrendingDownIcon className="size-3" />
                  )}
                  {data.viewsTrend >= 0 ? "+" : ""}
                  {data.viewsTrend}%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 items-center flex gap-2 font-medium">
                {data.viewsTrend >= 0 ? "Trending up" : "Trending down"} this
                week
                {data.viewsTrend >= 0 ? (
                  <TrendingUpIcon className="size-4" />
                ) : (
                  <TrendingDownIcon className="size-4" />
                )}
              </div>
              <div className="text-muted-foreground">All time blog views</div>
            </CardFooter>
          </Card>

          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Views This Week</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {data.viewsThisWeek.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <BarChart3Icon className="size-3" />7 days
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-sm">
              <div className="line-clamp-1 flex items-center  gap-2 font-medium">
                Weekly performance
                <EyeIcon className="size-4" />
              </div>
              <div className="text-muted-foreground">
                Views in the last 7 days
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Blogs</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {data.totalBlogs}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <FileTextIcon className="size-3" />
                  {data.publishedBlogs} live
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex items-center gap-2 font-medium">
                {data.publishedBlogs} published,{" "}
                {data.totalBlogs - data.publishedBlogs} drafts
                <PenLineIcon className="size-4" />
              </div>
              <div className="text-muted-foreground">
                Total blog posts created
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Published Rate</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {data.totalBlogs > 0
                  ? Math.round((data.publishedBlogs / data.totalBlogs) * 100)
                  : 0}
                %
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  {data.publishedBlogs > data.totalBlogs / 2 ? (
                    <TrendingUpIcon className="size-3" />
                  ) : (
                    <TrendingDownIcon className="size-3" />
                  )}
                  {data.totalBlogs - data.publishedBlogs} drafts
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 items-center flex gap-2 font-medium">
                Publication ratio
                <FileTextIcon className="size-4" />
              </div>
              <div className="text-muted-foreground">
                Percentage of blogs published
              </div>
            </CardFooter>
          </Card>
        </div>

        {/* Views Chart */}
        <Card className="pt-0">
          <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
            <div className="grid flex-1 gap-1">
              <CardTitle>Blog Views</CardTitle>
              <CardDescription>
                Showing total views for the last 30 days
              </CardDescription>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger
                className="hidden w-[160px] rounded-lg sm:ml-auto sm:flex"
                aria-label="Select a value"
              >
                <SelectValue placeholder="Last 30 days" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="30d" className="rounded-lg">
                  Last 30 days
                </SelectItem>
                <SelectItem value="14d" className="rounded-lg">
                  Last 14 days
                </SelectItem>
                <SelectItem value="7d" className="rounded-lg">
                  Last 7 days
                </SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
            <ChartContainer
              config={chartConfig}
              className="aspect-auto h-[250px] w-full"
            >
              <AreaChart data={filteredChartData}>
                <defs>
                  <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-views)"
                      stopOpacity={0.8}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-views)"
                      stopOpacity={0.1}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => {
                        return new Date(value).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        });
                      }}
                      indicator="dot"
                    />
                  }
                />
                <Area
                  dataKey="views"
                  type="natural"
                  fill="url(#fillViews)"
                  stroke="var(--color-views)"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Bottom Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Posts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Posts</CardTitle>
            </CardHeader>
            <CardContent>
              {data.topPosts.length === 0 ? (
                <p className="text-muted-foreground text-sm">No posts yet</p>
              ) : (
                <div className="space-y-3">
                  {data.topPosts.map((post, i) => (
                    <div
                      key={post.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors"
                      onClick={() => router.push(`/blogs/${post.id}/edit`)}
                    >
                      <span className="text-muted-foreground w-6 text-sm font-medium">
                        {i + 1}.
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">
                        {post.title}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {post.views} views
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentBlogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No activity yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Post</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Views</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentBlogs.map((blog) => (
                      <TableRow
                        key={blog.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/blogs/${blog.id}/edit`)}
                      >
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {blog.title}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={blog.published ? "default" : "outline"}
                            className="text-xs"
                          >
                            {blog.published ? "Published" : "Draft"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {blog.views}
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
