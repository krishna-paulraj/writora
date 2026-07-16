import { Container, GitBranch, Github } from "lucide-react";

import { DashedLine } from "@/components/dashed-line";

const facts = [
  {
    title: "Open codebase",
    description: "Every line is public at github.com/krishna-paulraj/writora.",
    icon: Github,
  },
  {
    title: "Self-hostable",
    description:
      "Run the whole platform yourself with the Docker compose stack.",
    icon: Container,
  },
  {
    title: "Independent",
    description: "Built and maintained as an indie project. No investors.",
    icon: GitBranch,
  },
];

export function AboutHero() {
  return (
    <section>
      <div className="container flex max-w-5xl flex-col justify-between gap-8 md:gap-20 lg:flex-row lg:items-center lg:gap-24 xl:gap-24">
        <div className="flex-[1.5]">
          <h1 className="text-3xl tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            Content infrastructure you can own
          </h1>

          <p className="text-muted-foreground mt-5 text-2xl md:text-3xl lg:text-4xl">
            Writora is an independent, open-codebase project building an AI SEO
            content engine.
          </p>

          <p className="text-muted-foreground mt-8 hidden max-w-lg text-lg text-balance md:block lg:mt-12">
            The premise is simple: you shouldn&apos;t have to rent your content
            stack. Keyword research, AI drafting, SEO scoring, publishing,
            subscribers, analytics — all of it runs on code you can read,
            self-host, and change. The hosted service exists for people who
            would rather not run their own servers.
          </p>
        </div>

        <div className="relative flex flex-1 flex-col justify-center gap-6 pt-10 lg:pt-0 lg:pl-10">
          <DashedLine
            orientation="vertical"
            className="absolute top-0 left-0 max-lg:hidden"
          />
          <DashedLine
            orientation="horizontal"
            className="absolute top-0 lg:hidden"
          />
          {facts.map((fact) => {
            const Icon = fact.icon;
            return (
              <div key={fact.title} className="flex gap-3">
                <Icon className="text-foreground mt-1 size-5 shrink-0" />
                <div>
                  <div className="font-semibold">{fact.title}</div>
                  <div className="text-muted-foreground text-sm">
                    {fact.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
