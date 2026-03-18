"use client";

import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PostNav {
  slug: string;
  title: string;
}

interface PostNavigationProps {
  username: string;
  previousPost: PostNav | null;
  nextPost: PostNav | null;
}

export function PostNavigation({
  username,
  previousPost,
  nextPost,
}: PostNavigationProps) {
  return (
    <div className="flex w-full justify-between">
      {previousPost ? (
        <Link href={`/${username}/${previousPost.slug}`}>
          <Button className="rounded-[8px]" variant="outline">
            <ChevronLeftIcon className="size-4" />
            Previous Post
          </Button>
        </Link>
      ) : (
        <Button className="rounded-[8px]" variant="outline" disabled>
          <ChevronLeftIcon className="size-4" />
          Previous Post
        </Button>
      )}

      {nextPost ? (
        <Link className="ml-auto" href={`/${username}/${nextPost.slug}`}>
          <Button
            className="rounded-[8px] bg-sky-600/10 text-sky-600 hover:bg-sky-600/20 focus-visible:ring-sky-600/20 dark:bg-sky-400/10 dark:text-sky-400 dark:hover:bg-sky-400/20 dark:focus-visible:ring-sky-400/40"
            variant="outline"
          >
            Next Post
            <ChevronRightIcon className="size-4" />
          </Button>
        </Link>
      ) : (
        <Button
          className="ml-auto rounded-[8px] bg-sky-600/10 text-sky-600 hover:bg-sky-600/20 focus-visible:ring-sky-600/20 dark:bg-sky-400/10 dark:text-sky-400 dark:hover:bg-sky-400/20 dark:focus-visible:ring-sky-400/40"
          variant="outline"
          disabled
        >
          Next Post
          <ChevronRightIcon className="size-4" />
        </Button>
      )}
    </div>
  );
}
