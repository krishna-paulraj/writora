import { notFound } from "next/navigation";
import { BlogHero } from "@/components/blog/blog-hero";
import { BlogGrid } from "@/components/blog/blog-grid";
import { BlogThemeProvider } from "@/components/blog/blog-theme-provider";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default async function UserBlogPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const res = await fetch(`${API_URL}/blogs/public/${username}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    notFound();
  }

  const data = await res.json();
  const { user, blogs } = data;

  const featuredPosts = blogs.filter(
    (post: { featured: boolean }) => post.featured,
  );

  return (
    <BlogThemeProvider themeId={user.blogTheme || "default"}>
      <BlogHero user={user} featuredPosts={featuredPosts} />
      <BlogGrid posts={blogs} username={username} />
    </BlogThemeProvider>
  );
}
