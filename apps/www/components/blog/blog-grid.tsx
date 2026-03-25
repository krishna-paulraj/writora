"use client";

import { useState } from "react";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { BlogCard } from "./blog-card";
import type { BlogPost } from "./types";

interface BlogGridProps {
  posts: BlogPost[];
  username: string;
}

export function BlogGrid({ posts, username }: BlogGridProps) {
  const [selectedTab, setSelectedTab] = useState("All");
  const [search, setSearch] = useState("");

  const uniqueCategories = [...new Set(posts.map((post) => post.category))];
  const categories = ["All", ...uniqueCategories.sort()];

  const filteredPosts = posts
    .filter((post) => selectedTab === "All" || post.category === selectedTab)
    .filter(
      (post) =>
        !search ||
        post.title.toLowerCase().includes(search.toLowerCase()) ||
        post.description.toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <section className="py-8 sm:py-16 lg:py-24" id="categories">
      <div className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:space-y-16 lg:px-8">
        <div className="space-y-4">
          <h2
            className="text-2xl font-semibold font-serif md:text-3xl lg:text-4xl"
          >
            All Posts
          </h2>
          <p className="text-muted-foreground text-lg md:text-xl">
            Browse all blog posts by category.
          </p>
        </div>

        <Tabs
          defaultValue="All"
          value={selectedTab}
          onValueChange={setSelectedTab}
          className="w-full flex flex-col gap-8 lg:gap-16"
        >
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <ScrollArea className="bg-muted w-full rounded-lg sm:w-auto">
              <TabsList className="h-auto gap-1">
                {categories.map((category) => (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="hover:bg-primary/10 cursor-pointer rounded-lg px-4 text-base"
                  >
                    {category}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <div className="relative max-md:w-full">
              <div className="text-muted-foreground pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-3">
                <SearchIcon className="size-4" />
              </div>
              <Input
                type="search"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 px-9 [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none"
              />
            </div>
          </div>

          <TabsContent value={selectedTab} className="w-full">
            {filteredPosts.length === 0 ? (
              <div className="text-muted-foreground py-12 text-center">
                No posts found.
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPosts.map((post) => (
                  <BlogCard key={post.id} post={post} username={username} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
