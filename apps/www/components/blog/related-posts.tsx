"use client";

import { Badge } from "@/components/ui/badge";
import { BlogCard } from "./blog-card";
import type { BlogPost } from "./types";

interface RelatedPostsProps {
  posts: BlogPost[];
  username: string;
}

export function RelatedPosts({ posts, username }: RelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="py-8 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-7xl space-y-16 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <Badge variant="outline">Trending</Badge>
          <h2
            className="text-2xl font-semibold md:text-3xl lg:text-4xl"
            style={{
              fontFamily:
                "var(--font-blog-serif), ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
            }}
          >
            Related Posts
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl">
            Expand your knowledge with these hand-picked posts.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.id} post={post} username={username} />
          ))}
        </div>
      </div>
    </section>
  );
}
