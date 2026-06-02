import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogGrid } from "@/components/blog/blog-grid";
import { BlogThemeProvider } from "@/components/blog/blog-theme-provider";
import { AuthorIntro } from "@/components/blog/author-intro";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";
const SITE_NAME = "Writora";

const fetchSiteBlogs = cache(async (siteSlug: string) => {
  const res = await fetch(`${API_URL}/blogs/public/site/${siteSlug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}): Promise<Metadata> {
  const { siteSlug } = await params;
  const data = await fetchSiteBlogs(siteSlug);
  if (!data) return { title: "Not found" };
  const { user } = data;
  const url = `${SITE_URL}/s/${siteSlug}`;
  return {
    title: user.name,
    description: `Read articles by ${user.name} on ${SITE_NAME}.`,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title: user.name,
      url,
      siteName: SITE_NAME,
    },
  };
}

export default async function SiteBlogPage({
  params,
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const data = await fetchSiteBlogs(siteSlug);
  if (!data) notFound();

  const { user, blogs } = data;
  const basePath = `/s/${siteSlug}`;

  return (
    <BlogThemeProvider themeId={user.blogTheme || "default"}>
      <AuthorIntro user={user} />
      <BlogGrid posts={blogs} username={user.username} basePath={basePath} />
    </BlogThemeProvider>
  );
}
