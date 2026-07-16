import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Writora — AI SEO content engine you can own";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
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
          AI SEO content engine
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 700,
            color: "#0a0a0a",
            fontFamily: "serif",
            letterSpacing: -3,
            lineHeight: 1.05,
          }}
        >
          Writora
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 34,
            color: "#525252",
            fontFamily: "sans-serif",
            marginTop: 8,
          }}
        >
          Research keywords. Generate articles. Publish everywhere.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 28,
          color: "#737373",
          fontFamily: "sans-serif",
          letterSpacing: 1,
        }}
      >
        <div style={{ display: "flex" }}>Open codebase. Self-hostable.</div>
        <div style={{ display: "flex" }}>writora</div>
      </div>
    </div>,
    { ...size },
  );
}
