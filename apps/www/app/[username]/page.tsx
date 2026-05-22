import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogHero } from "@/components/blog/blog-hero";
import { BlogGrid } from "@/components/blog/blog-grid";
import { BlogThemeProvider } from "@/components/blog/blog-theme-provider";
import { SubscribeCard } from "@/components/blog/subscribe-card";
import { AuthorIntro } from "@/components/blog/author-intro";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";
const SITE_NAME = "Writora";

const fetchUserBlogs = cache(async (username: string) => {
  const res = await fetch(`${API_URL}/blogs/public/${username}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const data = await fetchUserBlogs(username);
  if (!data) return { title: "Not found" };

  const { user } = data;
  const title = user.name;
  const description = `Read articles by ${user.name} on ${SITE_NAME}.`;
  const url = `${SITE_URL}/${username}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: {
        "application/rss+xml": `${SITE_URL}/${username}/feed.xml`,
      },
    },
    openGraph: {
      type: "profile",
      title,
      description,
      url,
      siteName: SITE_NAME,
      username: user.username,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function UserBlogPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const data = await fetchUserBlogs(username);
  if (!data) notFound();

  const { user, blogs } = data;

  const featuredPosts = blogs.filter(
    (post: { featured: boolean }) => post.featured,
  );

  return (
    <BlogThemeProvider themeId={user.blogTheme || "default"}>
      <AuthorIntro user={user} />
      {featuredPosts.length > 0 ? (
        <BlogHero user={user} featuredPosts={featuredPosts} />
      ) : null}
      <BlogGrid posts={blogs} username={username} />
      <section className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
        <SubscribeCard username={username} authorName={user.name} />
      </section>
    </BlogThemeProvider>
  );
}
