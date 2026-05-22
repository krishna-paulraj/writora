import { cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { BlogThemeProvider } from "@/components/blog/blog-theme-provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { DynamicToc } from "@/components/blog/dynamic-toc";
import { MarkdownRenderer } from "@/components/blog/markdown-renderer";
import { PostNavigation } from "@/components/blog/post-navigation";
import { RelatedPosts } from "@/components/blog/related-posts";
import { DraftBanner } from "@/components/blog/draft-banner";
import { ViewTracker } from "@/components/blog/view-tracker";
import { SubscribeCard } from "@/components/blog/subscribe-card";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";
const SITE_NAME = "Writora";

const fetchBlog = cache(async (username: string, slug: string) => {
  // Try public endpoint first
  const publicRes = await fetch(`${API_URL}/blogs/public/${username}/${slug}`, {
    cache: "no-store",
  });

  if (publicRes.ok) {
    const data = await publicRes.json();
    return { ...data, draft: false };
  }

  // If not found, try authenticated preview (for draft posts)
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  const previewRes = await fetch(`${API_URL}/blogs/preview/${slug}`, {
    cache: "no-store",
    headers: { Cookie: `token=${token}` },
  });

  if (!previewRes.ok) return null;

  const data = await previewRes.json();
  return { ...data, draft: true };
});

function stripHtml(html: string, max = 160): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? text.slice(0, max - 1).trimEnd() + "…" : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  const data = await fetchBlog(username, slug);
  if (!data) return { title: "Not found" };

  const { blog, draft } = data;
  const url = `${SITE_URL}/${username}/${slug}`;
  const description = blog.description?.trim() || stripHtml(blog.content);
  const images = blog.imageUrl
    ? [{ url: blog.imageUrl, alt: blog.title }]
    : undefined;

  return {
    title: blog.title,
    description,
    alternates: {
      canonical: url,
      types: {
        "application/rss+xml": `${SITE_URL}/${username}/feed.xml`,
      },
    },
    robots: draft
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: "article",
      title: blog.title,
      description,
      url,
      siteName: SITE_NAME,
      images,
      publishedTime: blog.createdAt,
      modifiedTime: blog.updatedAt,
      authors: [blog.author.name],
      tags: blog.category ? [blog.category] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: blog.title,
      description,
      images: blog.imageUrl ? [blog.imageUrl] : undefined,
      creator: blog.author.username ? `@${blog.author.username}` : undefined,
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;

  const data = await fetchBlog(username, slug);
  if (!data) notFound();

  const { blog, blogTheme, previousPost, nextPost, relatedPosts, draft } = data;

  const date = new Date(blog.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });

  const initials = blog.author.name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase();

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: blog.title,
    description: blog.description || undefined,
    image: blog.imageUrl || undefined,
    datePublished: blog.createdAt,
    dateModified: blog.updatedAt,
    author: {
      "@type": "Person",
      name: blog.author.name,
      url: `${SITE_URL}/${username}`,
    },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/${username}/${slug}`,
    },
    articleSection: blog.category || undefined,
  };

  return (
    <BlogThemeProvider themeId={blogTheme || "default"}>
      {!draft && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />
      )}
      {!draft && <ViewTracker blogId={blog.id} />}
      {draft && <DraftBanner />}
      <section className="py-8 sm:pt-16 sm:pb-24">
        <div className="mx-auto mt-18 max-w-7xl space-y-8 px-4 sm:px-6 lg:space-y-16 lg:px-8">
          <div className="gap-16 md:grid md:grid-cols-5 lg:grid-cols-7">
            <div className="hidden md:col-span-2 md:block lg:col-span-2">
              <DynamicToc />
            </div>

            <div className="space-y-12 md:col-span-3 lg:col-span-5">
              <div className="space-y-6">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink href={`/${username}`}>
                        Home
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbLink href={`/${username}#categories`}>
                        Blog
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{blog.category}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>

                <h1 className="text-foreground font-serif text-4xl font-semibold">
                  {blog.title}
                </h1>

                <p className="text-muted-foreground text-xl">
                  {blog.description}
                </p>

                <Separator />

                <div className="flex flex-wrap justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar className="size-11.5">
                      <AvatarImage src="" alt={blog.author.name} />
                      <AvatarFallback className="text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground text-sm">
                        Written by
                      </span>
                      <span className="text-foreground text-sm font-medium">
                        {blog.author.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground text-sm">
                      Read Time
                    </span>
                    <span className="text-foreground text-sm font-medium">
                      {blog.readTime} minute read
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-muted-foreground text-sm">
                      Posted on
                    </span>
                    <span className="text-foreground text-sm font-medium">
                      {date}
                    </span>
                  </div>
                </div>
              </div>

              {blog.imageUrl && (
                <div>
                  <img
                    src={blog.imageUrl}
                    alt={blog.title}
                    className="max-h-148 w-full rounded-[8px]"
                  />
                </div>
              )}

              <article id="content" className="space-y-12">
                <MarkdownRenderer content={blog.content} />
              </article>

              {!draft && (
                <SubscribeCard
                  username={username}
                  authorName={blog.author.name}
                />
              )}

              {!draft && (
                <PostNavigation
                  username={username}
                  previousPost={previousPost}
                  nextPost={nextPost}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {!draft && <RelatedPosts posts={relatedPosts} username={username} />}
    </BlogThemeProvider>
  );
}
