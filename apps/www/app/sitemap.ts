import type { MetadataRoute } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";

interface SitemapEntry {
  username: string;
  slug: string;
  updatedAt: string;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  try {
    const res = await fetch(`${API_URL}/blogs/sitemap`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return staticRoutes;

    const blogs = (await res.json()) as SitemapEntry[];
    const userPages = new Map<string, Date>();

    const blogEntries: MetadataRoute.Sitemap = blogs.map((b) => {
      const lastModified = new Date(b.updatedAt);
      const existing = userPages.get(b.username);
      if (!existing || lastModified > existing) {
        userPages.set(b.username, lastModified);
      }
      return {
        url: `${SITE_URL}/${b.username}/${b.slug}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.8,
      };
    });

    const userEntries: MetadataRoute.Sitemap = Array.from(
      userPages.entries(),
    ).map(([username, lastModified]) => ({
      url: `${SITE_URL}/${username}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticRoutes, ...userEntries, ...blogEntries];
  } catch {
    return staticRoutes;
  }
}
