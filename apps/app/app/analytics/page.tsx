"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EyeIcon,
  ExternalLinkIcon,
  FileTextIcon,
  ClockIcon,
  TrendingUpIcon,
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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface BlogStat {
  id: string;
  title: string;
  slug: string;
  category: string;
  published: boolean;
  createdAt: string;
  readTime: number;
  views: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [blogs, setBlogs] = useState<BlogStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/analytics/blogs`, { credentials: "include" })
      .then((res) => res.json())
      .then(setBlogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <>
        <SiteHeader title="Analytics" />
        <div className="text-muted-foreground py-24 text-center">
          Loading...
        </div>
      </>
    );
  }

  const totalViews = blogs.reduce((sum, b) => sum + b.views, 0);
  const avgReadTime =
    blogs.length > 0
      ? Math.round(
          blogs.reduce((sum, b) => sum + b.readTime, 0) / blogs.length,
        )
      : 0;

  const chartData = [...blogs]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
    .map((b) => ({
      name: b.title,
      views: b.views,
    }));

  const categoryMap: Record<string, number> = {};
  for (const b of blogs) {
    categoryMap[b.category] = (categoryMap[b.category] || 0) + b.views;
  }
  const categoryData = Object.entries(categoryMap)
    .map(([name, views]) => ({ name, views }))
    .sort((a, b) => b.views - a.views);

  return (
    <>
      <SiteHeader title="Analytics" />
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Views</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {totalViews.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <EyeIcon className="size-3" />
                  all time
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex items-center gap-2 font-medium">
                Across all blog posts
                <TrendingUpIcon className="size-4" />
              </div>
              <div className="text-muted-foreground">
                Total page views received
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Total Posts</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {blogs.length}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <FileTextIcon className="size-3" />
                  {blogs.filter((b) => b.published).length} live
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex items-center gap-2 font-medium">
                {blogs.filter((b) => b.published).length} published, {blogs.filter((b) => !b.published).length} drafts
                <FileTextIcon className="size-4" />
              </div>
              <div className="text-muted-foreground">
                All blog posts created
              </div>
            </CardFooter>
          </Card>

          <Card className="@container/card">
            <CardHeader>
              <CardDescription>Avg. Read Time</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {avgReadTime} min
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <ClockIcon className="size-3" />
                  per post
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex items-center gap-2 font-medium">
                Average reading time
                <ClockIcon className="size-4" />
              </div>
              <div className="text-muted-foreground">
                Across all blog posts
              </div>
            </CardFooter>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Views per Blog</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-muted-foreground text-sm">No data yet</p>
              ) : (
                <div>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={false} />
                      <YAxis tick={{ fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-foreground)" }}
                        labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                      />
                      <Bar dataKey="views" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {chartData.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <div className="bg-primary size-2.5 rounded-sm" />
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="font-medium">({item.views})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Views by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <p className="text-muted-foreground text-sm">No data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 13 }} />
                    <YAxis tick={{ fill: "var(--color-muted-foreground)" }} allowDecimals={false} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px", color: "var(--color-foreground)" }} />
                    <Bar dataKey="views" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">All Posts Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Read Time</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blogs.map((blog) => (
                  <TableRow key={blog.id}>
                    <TableCell className="max-w-[250px] truncate font-medium">{blog.title}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{blog.category}</Badge></TableCell>
                    <TableCell><Badge variant={blog.published ? "default" : "outline"} className="text-xs">{blog.published ? "Published" : "Draft"}</Badge></TableCell>
                    <TableCell>{blog.readTime} min</TableCell>
                    <TableCell>{new Date(blog.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-medium">{blog.views}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/blogs/${blog.id}/edit`)}>
                        <ExternalLinkIcon className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
