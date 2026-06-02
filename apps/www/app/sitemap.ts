import type { MetadataRoute } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";

interface SitemapEntry {
  username: string;
  siteSlug: string;
  isPrimary: boolean;
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
    // Primary sites are addressed by /{username}; secondary sites by /s/{slug}.
    const sitePages = new Map<string, Date>();

    const blogEntries: MetadataRoute.Sitemap = blogs.map((b) => {
      const lastModified = new Date(b.updatedAt);
      const base = b.isPrimary ? `/${b.username}` : `/s/${b.siteSlug}`;
      const existing = sitePages.get(base);
      if (!existing || lastModified > existing) {
        sitePages.set(base, lastModified);
      }
      return {
        url: `${SITE_URL}${base}/${b.slug}`,
        lastModified,
        changeFrequency: "weekly",
        priority: 0.8,
      };
    });

    const siteEntries: MetadataRoute.Sitemap = Array.from(
      sitePages.entries(),
    ).map(([base, lastModified]) => ({
      url: `${SITE_URL}${base}`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

    return [...staticRoutes, ...siteEntries, ...blogEntries];
  } catch {
    return staticRoutes;
  }
}
