import { CalendarClock, Gauge, PenLine } from "lucide-react";

import { DashedLine } from "../dashed-line";

import { Card, CardContent } from "@/components/ui/card";

const items = [
  {
    title: "AI article generation",
    description:
      "Give it a topic or a keyword. Writora drafts the full article — with an SEO title, meta description, and AI-generated featured and inline images.",
    icon: PenLine,
    points: [
      "OpenAI-backed drafts",
      "SEO metadata included",
      "Featured + inline images",
    ],
  },
  {
    title: "Keyword research + SEO scoring",
    description:
      "Pull search volume and difficulty from DataForSEO before you write, then score every draft against on-page SEO checks in the editor.",
    icon: Gauge,
    points: [
      "Search volume + difficulty",
      "Wired into generation",
      "On-page scoring on every plan",
    ],
  },
  {
    title: "Autopilot content plans",
    description:
      "AI brainstorms an article cluster for your site, then generates and publishes each post on a cadence you set. You review, it ships.",
    icon: CalendarClock,
    points: [
      "AI-planned clusters",
      "Scheduled generation",
      "Hands-off publishing",
    ],
  },
];

export const Features = () => {
  return (
    <section id="features" className="pb-28 lg:pb-32">
      <div className="container">
        {/* Top dashed line with text */}
        <div className="relative flex items-center justify-center">
          <DashedLine className="text-muted-foreground" />
          <span className="bg-muted text-muted-foreground absolute px-3 font-mono text-sm font-medium tracking-wide max-md:hidden">
            RESEARCH. WRITE. PUBLISH.
          </span>
        </div>

        {/* Content */}
        <div className="mx-auto mt-10 grid max-w-4xl items-center gap-3 md:gap-0 lg:mt-24 lg:grid-cols-2">
          <h2 className="text-2xl tracking-tight md:text-4xl lg:text-5xl">
            Everything between a keyword and a ranking post
          </h2>
          <p className="text-muted-foreground leading-snug">
            Writora covers the whole content pipeline: find what people search
            for, generate a draft worth publishing, and keep the cadence going
            without you.
          </p>
        </div>

        {/* Features Card */}
        <Card className="mt-8 rounded-3xl md:mt-12 lg:mt-20">
          <CardContent className="flex p-0 max-md:flex-col">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={i} className="flex flex-1 max-md:flex-col">
                  <div className="flex-1 p-4 md:p-6">
                    <div className="flex h-full flex-col gap-4 pt-2 md:gap-6">
                      <div className="w-fit rounded-full border p-2.5">
                        <Icon className="size-5 lg:size-6" />
                      </div>
                      <h3 className="font-display max-w-60 text-2xl leading-tight font-bold tracking-tight">
                        {item.title}
                      </h3>
                      <p className="text-muted-foreground">
                        {item.description}
                      </p>
                      <ul className="text-muted-foreground mt-auto space-y-2 pt-2 text-sm">
                        {item.points.map((point) => (
                          <li
                            key={point}
                            className="flex items-center gap-2 border-t pt-2 first:border-t-0 first:pt-0"
                          >
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {i < items.length - 1 && (
                    <div className="relative hidden md:block">
                      <DashedLine orientation="vertical" />
                    </div>
                  )}
                  {i < items.length - 1 && (
                    <div className="relative block md:hidden">
                      <DashedLine orientation="horizontal" />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
