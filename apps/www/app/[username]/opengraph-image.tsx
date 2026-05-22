import { ImageResponse } from "next/og";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const runtime = "nodejs";
export const alt = "Author profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let name = username;
  let postCount = 0;

  try {
    const res = await fetch(`${API_URL}/blogs/public/${username}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = await res.json();
      name = data.user?.name || username;
      postCount = Array.isArray(data.blogs) ? data.blogs.length : 0;
    }
  } catch {
    // Fall through
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
        padding: "100px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: "#737373",
            textTransform: "uppercase",
            letterSpacing: 4,
            fontFamily: "sans-serif",
            fontWeight: 500,
          }}
        >
          Blog
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 96,
            fontWeight: 700,
            color: "#0a0a0a",
            fontFamily: "serif",
            letterSpacing: -2,
            lineHeight: 1.05,
          }}
        >
          {name}
        </div>
        {postCount > 0 ? (
          <div
            style={{
              display: "flex",
              fontSize: 30,
              color: "#525252",
              fontFamily: "sans-serif",
              marginTop: 12,
            }}
          >
            {postCount} {postCount === 1 ? "article" : "articles"}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          fontSize: 28,
          color: "#737373",
          fontFamily: "sans-serif",
          letterSpacing: 1,
        }}
      >
        writora
      </div>
    </div>,
    { ...size },
  );
}
