import Link from "next/link";

import {
  ArrowRight,
  CalendarClock,
  Search,
  Send,
  Sparkles,
} from "lucide-react";

import { DashedLine } from "@/components/dashed-line";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Keyword research",
    description:
      "Search volume and difficulty from DataForSEO, wired straight into generation.",
    icon: Search,
  },
  {
    title: "AI articles",
    description:
      "Full drafts with SEO metadata, plus AI featured and inline images.",
    icon: Sparkles,
  },
  {
    title: "Autopilot",
    description:
      "AI plans an article cluster, then writes and publishes on your cadence.",
    icon: CalendarClock,
  },
  {
    title: "Publish everywhere",
    description:
      "Your hosted blog, WordPress, Dev.to, and X auto-posts — from one editor.",
    icon: Send,
  },
];

export const Hero = () => {
  return (
    <section className="py-28 lg:py-32 lg:pt-44">
      <div className="container flex flex-col justify-between gap-8 md:gap-14 lg:flex-row lg:gap-20">
        {/* Left side - Main content */}
        <div className="flex-1">
          <h1 className="text-foreground max-w-160 text-3xl tracking-tight md:text-4xl lg:text-5xl">
            The AI SEO content engine you can own
          </h1>

          <p className="text-muted-foreground mt-5 text-xl md:text-2xl">
            Research keywords, generate articles with metadata and images, and
            publish them everywhere — on a schedule you set.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4 lg:flex-nowrap">
            <Button asChild>
              <Link href="/signup">Start for free</Link>
            </Button>
            <Button
              variant="outline"
              className="from-background h-auto gap-2 bg-linear-to-r to-transparent shadow-md"
              asChild
            >
              <Link href="/pricing">
                See pricing
                <ArrowRight className="stroke-3" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Right side - Features */}
        <div className="relative flex flex-1 flex-col justify-center space-y-5 max-lg:pt-10 lg:pl-10">
          <DashedLine
            orientation="vertical"
            className="absolute top-0 left-0 max-lg:hidden"
          />
          <DashedLine
            orientation="horizontal"
            className="absolute top-0 lg:hidden"
          />
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="flex gap-2.5 lg:gap-5">
                <Icon className="text-foreground mt-1 size-4 shrink-0 lg:size-5" />
                <div>
                  <h2 className="font-text text-foreground font-semibold">
                    {feature.title}
                  </h2>
                  <p className="text-muted-foreground max-w-76 text-sm">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
