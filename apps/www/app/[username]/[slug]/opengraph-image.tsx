import { ImageResponse } from "next/og";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const runtime = "nodejs";
export const alt = "Blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;

  let title = "Untitled";
  let description = "";
  let authorName = "";
  let category = "";

  try {
    const res = await fetch(`${API_URL}/blogs/public/${username}/${slug}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      title = data.blog.title || title;
      description = data.blog.description || "";
      authorName = data.blog.author?.name || "";
      category = data.blog.category || "";
    }
  } catch {
    // Fall through to placeholder image
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#fafaf9",
        padding: "90px 100px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        {category ? (
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "#737373",
              textTransform: "uppercase",
              letterSpacing: 4,
              fontFamily: "sans-serif",
              fontWeight: 500,
            }}
          >
            {category}
          </div>
        ) : null}
        <div
          style={{
            display: "flex",
            fontSize: title.length > 60 ? 64 : 80,
            fontWeight: 700,
            color: "#0a0a0a",
            lineHeight: 1.1,
            fontFamily: "serif",
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
        {description ? (
          <div
            style={{
              display: "flex",
              fontSize: 28,
              color: "#525252",
              lineHeight: 1.4,
              fontFamily: "sans-serif",
              marginTop: 8,
            }}
          >
            {description.length > 140
              ? description.slice(0, 137) + "…"
              : description}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderTop: "1px solid #e5e5e5",
          paddingTop: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#262626",
            fontFamily: "sans-serif",
            fontWeight: 500,
          }}
        >
          {authorName}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "#737373",
            fontFamily: "sans-serif",
            letterSpacing: 1,
          }}
        >
          writora
        </div>
      </div>
    </div>,
    { ...size },
  );
}
