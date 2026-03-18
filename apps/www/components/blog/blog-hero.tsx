"use client";

import Link from "next/link";
import { ArrowUpRightIcon, CalendarDaysIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BlogPost, BlogUser } from "./types";

interface BlogHeroProps {
  user: BlogUser;
  featuredPosts: BlogPost[];
}

export function BlogHero({ user, featuredPosts }: BlogHeroProps) {
  if (featuredPosts.length === 0) return null;

  return (
    <section id="home" className="bg-muted rounded-t-4xl pt-32 pb-12 sm:pb-16 lg:pb-24">
      <div className="mx-auto mt-5 flex h-full max-w-7xl flex-col gap-16 px-4 sm:px-6 lg:px-8">
        <div className="flex max-w-4xl flex-col items-center gap-4 self-center text-center">
          <Badge variant="outline" className="text-sm font-normal">
            {user.name}&apos;s Blog
          </Badge>
          <h1
            className="text-3xl leading-[1.29167] font-semibold text-balance sm:text-4xl lg:text-5xl"
            style={{
              fontFamily:
                "var(--font-blog-serif), ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
            }}
          >
            Featured Posts
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
            Explore the latest featured articles from {user.name}.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {featuredPosts.map((post) => {
            const date = new Date(post.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "2-digit",
            });

            return (
              <Card
                key={post.id}
                className="group cursor-pointer py-0 shadow-none"
              >
                <Link href={`/${user.username}/${post.slug}`}>
                  <CardContent className="grid grid-cols-1 px-0 xl:grid-cols-2">
                    {post.imageUrl && (
                      <div className="p-6">
                        <div className="h-59.5 w-full overflow-hidden rounded-lg">
                          <img
                            src={post.imageUrl}
                            alt={post.title}
                            className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col justify-center gap-3 p-6">
                      <div className="flex items-center gap-1.5 py-1">
                        <div className="text-muted-foreground flex grow items-center gap-1.5">
                          <CalendarDaysIcon className="size-5" />
                          <p>{date}</p>
                        </div>
                        <Badge className="bg-primary/10 text-primary cursor-pointer border-0 text-sm">
                          {post.category}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-medium">{post.title}</h3>
                      <p className="text-muted-foreground">
                        {post.description}
                      </p>
                      <div className="flex w-full items-center justify-between gap-1 py-1">
                        <span className="cursor-pointer text-sm font-medium">
                          {post.author.name}
                        </span>
                        <Button
                          size="icon"
                          className="group-hover:bg-primary! bg-background text-foreground hover:bg-primary! hover:text-primary-foreground group-hover:text-primary-foreground border group-hover:border-transparent hover:border-transparent"
                        >
                          <ArrowUpRightIcon />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Link>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
