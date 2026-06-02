import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { BlogThemeProvider } from "@/components/blog/blog-theme-provider";
import { MarkdownRenderer } from "@/components/blog/markdown-renderer";
import { ViewTracker } from "@/components/blog/view-tracker";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";
const SITE_NAME = "Writora";

const fetchPost = cache(async (siteSlug: string, slug: string) => {
  const res = await fetch(`${API_URL}/blogs/public/site/${siteSlug}/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
});

function stripHtml(html: string, max = 160): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string; slug: string }>;
}): Promise<Metadata> {
  const { siteSlug, slug } = await params;
  const data = await fetchPost(siteSlug, slug);
  if (!data) return { title: "Not found" };
  const { blog } = data;
  const url = `${SITE_URL}/s/${siteSlug}/${slug}`;
  const description = blog.description?.trim() || stripHtml(blog.content);
  return {
    title: blog.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: blog.title,
      description,
      url,
      siteName: SITE_NAME,
      images: blog.imageUrl ? [{ url: blog.imageUrl }] : undefined,
    },
  };
}

export default async function SitePostPage({
  params,
}: {
  params: Promise<{ siteSlug: string; slug: string }>;
}) {
  const { siteSlug, slug } = await params;
  const data = await fetchPost(siteSlug, slug);
  if (!data) notFound();

  const { blog, blogTheme } = data;
  const date = new Date(blog.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });

  return (
    <BlogThemeProvider themeId={blogTheme || "default"}>
      <ViewTracker blogId={blog.id} />
      <section className="py-8 sm:pt-16 sm:pb-24">
        <div className="mx-auto mt-18 max-w-3xl space-y-8 px-4 sm:px-6 lg:px-8">
          <Link
            href={`/s/${siteSlug}`}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeftIcon className="size-4" />
            {blog.author.name}
          </Link>

          <div className="space-y-6">
            <Badge className="bg-primary/10 text-primary border-0">
              {blog.category}
            </Badge>
            <h1 className="text-foreground font-serif text-4xl font-semibold">
              {blog.title}
            </h1>
            <p className="text-muted-foreground text-xl">{blog.description}</p>
            <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
              <span>{blog.author.name}</span>
              <span>{blog.readTime} min read</span>
              <span>{date}</span>
            </div>
            <Separator />
          </div>

          {blog.imageUrl && (
            <img
              src={blog.imageUrl}
              alt={blog.title}
              className="max-h-148 w-full rounded-lg object-cover"
            />
          )}

          <article id="content" className="space-y-12">
            <MarkdownRenderer content={blog.content} />
          </article>
        </div>
      </section>
    </BlogThemeProvider>
  );
}
