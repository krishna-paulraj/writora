"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-foreground mt-16 mb-6 text-3xl font-semibold">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-foreground mt-16 mb-4 text-2xl font-semibold">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-foreground mb-4 text-xl font-medium">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-muted-foreground mb-4 leading-7">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-4 list-inside list-disc space-y-2 pl-2">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-inside list-decimal space-y-2 pl-2">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="text-muted-foreground leading-7">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="text-muted-foreground border-primary my-4 border-l-4 pl-4 italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className="bg-muted block overflow-x-auto rounded-lg p-4 text-sm">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-muted rounded px-1.5 py-0.5 text-sm">
        {children}
      </code>
    );
  },
  pre: ({ children }) => <pre className="my-4">{children}</pre>,
  a: ({ children, href }) => (
    <a
      href={href}
      className="text-primary underline underline-offset-4"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

interface BlogData {
  blog: {
    title: string;
    slug: string;
    description: string;
    content: string;
    imageUrl: string | null;
    category: string;
    readTime: number;
    createdAt: string;
    published: boolean;
    author: { name: string; username: string };
  };
  draft: boolean;
}

export default function PreviewPage() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug");
  const [data, setData] = useState<BlogData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    fetch(`${API_URL}/blogs/preview/${slug}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-24">
        Loading preview...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-muted-foreground flex items-center justify-center py-24">
        Blog not found
      </div>
    );
  }

  const { blog, draft } = data;
  const date = new Date(blog.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
  const initials = blog.author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen">
      {draft && (
        <div className="bg-primary/10 text-primary px-4 py-2 text-center text-sm font-medium">
          Draft Preview — This post is not published yet
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <Button
          variant="ghost"
          size="sm"
          className="mb-6"
          onClick={() => window.history.back()}
        >
          <ArrowLeftIcon className="mr-1.5 size-3.5" />
          Back to editor
        </Button>

        <div className="space-y-6">
          <Badge variant="secondary">{blog.category}</Badge>

          <h1 className="text-4xl font-semibold">{blog.title}</h1>

          <p className="text-muted-foreground text-xl">{blog.description}</p>

          <Separator />

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{blog.author.name}</span>
                <span className="text-muted-foreground text-xs">{date}</span>
              </div>
            </div>
            <span className="text-muted-foreground text-sm">
              {blog.readTime} min read
            </span>
          </div>
        </div>

        {blog.imageUrl && (
          <img
            src={blog.imageUrl}
            alt={blog.title}
            className="mt-8 w-full rounded-lg object-cover"
          />
        )}

        <article className="mt-12 space-y-4">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {blog.content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
