import { Background } from "@/components/background";
import type { Metadata } from "next";
import { Inter, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";

const inter = Inter({
  variable: "--font-blog-sans",
  subsets: ["latin"],
});

const sourceSerif4 = Source_Serif_4({
  variable: "--font-blog-serif",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-blog-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Blog - Writora",
  description: "Read blog posts on Writora",
};

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Background className="from-muted/80 via-muted to-muted/50">
      <div
        className={`blog-scope ${inter.variable} ${sourceSerif4.variable} ${ibmPlexMono.variable}`}
      >
        <style>{`
        .blog-scope {
          font-family: var(--font-blog-sans), ui-sans-serif, system-ui, sans-serif;
          --display-family: var(--font-blog-serif), ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
          --text-family: var(--font-blog-sans), ui-sans-serif, system-ui, sans-serif;
          --font-sans: var(--font-blog-sans), ui-sans-serif, system-ui, sans-serif;
          --font-serif: var(--font-blog-serif), ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
          --font-mono: var(--font-blog-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          --font-display: var(--font-blog-serif), ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
          --font-text: var(--font-blog-sans), ui-sans-serif, system-ui, sans-serif;
        }
        .blog-scope h1,
        .blog-scope h2,
        .blog-scope h3 {
          font-family: var(--font-blog-serif), ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif;
        }
        .blog-scope code,
        .blog-scope pre code {
          font-family: var(--font-blog-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
      `}</style>
        {children}
      </div>
    </Background>
  );
}
