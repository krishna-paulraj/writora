import Image from "next/image";

import { Globe, Link2, Mail } from "lucide-react";

import { DashedLine } from "../dashed-line";

const seoDefaults = [
  "Sitemaps",
  "RSS feeds",
  "JSON-LD",
  "Dynamic OG images",
  "40+ themes",
];

const destinations = [
  { src: "/logo.svg", alt: "Writora hosted blog", invert: true },
  { src: "/logos/wordpress.svg", alt: "WordPress", invert: false },
  { src: "/logos/devto.svg", alt: "Dev.to", invert: true },
  { src: "/logos/x.svg", alt: "X", invert: true },
];

const bottomItems = [
  {
    title: "Multi-site workspaces.",
    description:
      "Run every brand from one account. Each site gets its own themable public blog — and its own custom domain on paid plans.",
    icon: Globe,
  },
  {
    title: "Backlink network.",
    description:
      "Opt your sites in and related posts link to each other automatically, matched by semantic embeddings instead of link swaps.",
    icon: Link2,
  },
  {
    title: "Subscribers built in.",
    description:
      "Readers join your list with double opt-in, and every publish sends a newsletter to them automatically.",
    icon: Mail,
  },
];

export const ResourceAllocation = () => {
  return (
    <section id="workflow" className="overflow-hidden pb-28 lg:pb-32">
      <div>
        <h2 className="container text-center text-3xl tracking-tight text-balance sm:text-4xl md:text-5xl lg:text-6xl">
          One pipeline from keyword to published post
        </h2>

        <div className="mt-8 md:mt-12 lg:mt-20">
          <DashedLine
            orientation="horizontal"
            className="container scale-x-105"
          />

          {/* Top row - 2 items */}
          <div className="relative container flex max-md:flex-col">
            <div className="relative flex flex-1 flex-col justify-between px-0 py-6 md:px-6 md:py-8">
              <div className="mb-5 text-balance md:mb-8">
                <h3 className="inline font-semibold">
                  Built for search from day one.{" "}
                </h3>
                <span className="text-muted-foreground">
                  Every post ships with the SEO plumbing already wired up — no
                  plugins to configure.
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {seoDefaults.map((item) => (
                  <span
                    key={item}
                    className="bg-background text-muted-foreground rounded-full border px-3 py-1.5 text-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <DashedLine
                orientation="vertical"
                className="absolute top-0 right-0 max-md:hidden"
              />
              <DashedLine
                orientation="horizontal"
                className="absolute inset-x-0 bottom-0 md:hidden"
              />
            </div>

            <div className="relative flex flex-1 flex-col justify-between px-0 py-6 md:px-6 md:py-8">
              <div className="mb-5 text-balance md:mb-8">
                <h3 className="inline font-semibold">
                  Publish once, share everywhere.{" "}
                </h3>
                <span className="text-muted-foreground">
                  Push posts to WordPress via the Writora Connector, cross-post
                  to Dev.to, and auto-post to X — alongside your hosted blog.
                </span>
              </div>
              <div className="flex flex-wrap gap-5">
                {destinations.map((logo) => (
                  <div
                    key={logo.alt}
                    className="bg-background grid aspect-square size-16 place-items-center rounded-2xl border lg:size-20"
                  >
                    <Image
                      src={logo.src}
                      alt={logo.alt}
                      width={36}
                      height={36}
                      className={
                        logo.invert
                          ? "object-contain dark:invert"
                          : "object-contain"
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DashedLine
            orientation="horizontal"
            className="container max-w-7xl scale-x-110"
          />

          {/* Bottom row - 3 items */}
          <div className="relative container grid max-w-7xl md:grid-cols-3">
            {bottomItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="relative flex flex-col px-0 py-6 md:px-6 md:py-8"
                >
                  <Icon className="text-foreground mb-4 size-5" />
                  <div className="text-balance">
                    <h3 className="inline font-semibold">{item.title} </h3>
                    <span className="text-muted-foreground">
                      {item.description}
                    </span>
                  </div>
                  {i < bottomItems.length - 1 && (
                    <>
                      <DashedLine
                        orientation="vertical"
                        className="absolute top-0 right-0 max-md:hidden"
                      />
                      <DashedLine
                        orientation="horizontal"
                        className="absolute inset-x-0 bottom-0 md:hidden"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <DashedLine
          orientation="horizontal"
          className="container max-w-7xl scale-x-110"
        />
      </div>
    </section>
  );
};
