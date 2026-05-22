const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const SITE_URL = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";

interface Blog {
  slug: string;
  title: string;
  description: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}
interface PublicBlogList {
  user: { name: string; username: string };
  blogs: Blog[];
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function endCdata(s: string): string {
  // Prevent breaking out of a CDATA section
  return s.replace(/\]\]>/g, "]]]]><![CDATA[>");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  const res = await fetch(`${API_URL}/blogs/public/${username}`, {
    next: { revalidate: 600 },
  });
  if (!res.ok) {
    return new Response("Not found", { status: 404 });
  }

  const data = (await res.json()) as PublicBlogList;
  const { user, blogs } = data;
  const feedUrl = `${SITE_URL}/${username}/feed.xml`;
  const channelUrl = `${SITE_URL}/${username}`;

  const items = blogs
    .map((blog) => {
      const url = `${SITE_URL}/${username}/${blog.slug}`;
      const pubDate = new Date(blog.createdAt).toUTCString();
      const description = blog.description || "";
      return `    <item>
      <title>${escapeXml(blog.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${endCdata(description)}]]></description>
      ${blog.category ? `<category>${escapeXml(blog.category)}</category>` : ""}
    </item>`;
    })
    .join("\n");

  const lastBuildDate =
    blogs.length > 0
      ? new Date(blogs[0].updatedAt).toUTCString()
      : new Date().toUTCString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(user.name)}</title>
    <link>${channelUrl}</link>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    <description>Articles by ${escapeXml(user.name)}</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    },
  });
}
