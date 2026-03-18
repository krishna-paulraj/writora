"use client";

import Link from "next/link";
import { ArrowRightIcon, CalendarDaysIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BlogPost } from "./types";

interface BlogCardProps {
  post: BlogPost;
  username: string;
}

export function BlogCard({ post, username }: BlogCardProps) {
  const date = new Date(post.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });

  return (
    <Card className="group h-full cursor-pointer overflow-hidden shadow-none transition-all duration-300">
      <Link href={`/${username}/${post.slug}`}>
        <CardContent className="space-y-3.5">
          {post.imageUrl && (
            <div className="mb-6 overflow-hidden rounded-lg sm:mb-12">
              <img
                src={post.imageUrl}
                alt={post.title}
                className="h-59.5 w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-1.5">
            <div className="text-muted-foreground flex items-center gap-1.5">
              <CalendarDaysIcon className="size-5" />
              <span>{date}</span>
            </div>
            <Badge className="bg-primary/10 text-primary rounded-full border-0 text-sm">
              {post.category}
            </Badge>
          </div>
          <h3 className="line-clamp-2 text-lg font-medium md:text-xl">
            {post.title}
          </h3>
          <p className="text-muted-foreground line-clamp-2">
            {post.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{post.author.name}</span>
            <Button
              size="icon"
              className="group-hover:bg-primary! bg-background text-foreground hover:bg-primary! hover:text-primary-foreground group-hover:text-primary-foreground border group-hover:border-transparent hover:border-transparent"
            >
              <ArrowRightIcon className="size-4 -rotate-45" />
              <span className="sr-only">Read more: {post.title}</span>
            </Button>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
