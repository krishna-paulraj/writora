"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-foreground mt-16 mb-6 scroll-mt-20 font-serif text-3xl font-semibold">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-foreground mt-16 mb-4 scroll-mt-20 font-serif text-2xl font-semibold">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-foreground mb-4 scroll-mt-20 font-serif text-xl font-medium">
      {children}
    </h3>
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
        <code className="bg-muted block overflow-x-auto rounded-lg font-mono p-4 text-sm">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">
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
  img: ({ src, alt }) => (
    <img src={src} alt={alt || ""} className="my-4 rounded-lg" />
  ),
  hr: () => <hr className="border-border my-8" />,
};

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
