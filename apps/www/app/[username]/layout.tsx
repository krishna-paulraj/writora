import { Background } from "@/components/background";
import type { Metadata } from "next";

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
      <div className="blog-scope">
        {children}
      </div>
    </Background>
  );
}
