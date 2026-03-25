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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function fetchBlog(username: string, slug: string) {
  // Try public endpoint first
  const publicRes = await fetch(
    `${API_URL}/blogs/public/${username}/${slug}`,
    { cache: "no-store" },
  );

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
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;

  const data = await fetchBlog(username, slug);
  if (!data) notFound();

  const { blog, blogTheme, previousPost, nextPost, relatedPosts, draft } =
    data;

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

  return (
    <BlogThemeProvider themeId={blogTheme || "default"}>
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

                <h1
                  className="text-foreground text-4xl font-semibold font-serif"
                >
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
