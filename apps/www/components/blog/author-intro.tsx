import Link from "next/link";
import { GlobeIcon } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { BlogUser } from "./types";

interface AuthorIntroProps {
  user: BlogUser;
}

export function AuthorIntro({ user }: AuthorIntroProps) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const hasSocials = user.twitterHandle || user.websiteUrl;

  return (
    <section className="mx-auto max-w-3xl px-4 pt-24 pb-8 sm:px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Avatar className="size-20">
          <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
          <AvatarFallback className="text-xl">{initials}</AvatarFallback>
        </Avatar>
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
            {user.name}
          </h1>
          {user.bio ? (
            <p className="text-muted-foreground mx-auto max-w-xl text-base sm:text-lg">
              {user.bio}
            </p>
          ) : null}
        </div>
        {hasSocials ? (
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            {user.twitterHandle ? (
              <Link
                href={`https://x.com/${user.twitterHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground inline-flex items-center gap-1.5"
              >
                <FaXTwitter className="size-4" />@{user.twitterHandle}
              </Link>
            ) : null}
            {user.websiteUrl ? (
              <Link
                href={user.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground inline-flex items-center gap-1.5"
              >
                <GlobeIcon className="size-4" />
                {user.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
