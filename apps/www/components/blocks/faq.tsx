import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const categories = [
  {
    title: "Product",
    questions: [
      {
        question: "What is Writora?",
        answer:
          "Writora is an AI SEO content engine and blogging platform. You research keywords, generate article drafts with AI, score them for on-page SEO, and publish — to your own hosted blog, or out to WordPress, Dev.to, and X. Use the hosted service, or self-host the open codebase.",
      },
      {
        question: "Do I need my own OpenAI key?",
        answer:
          "No. Hosted plans include AI generation within your monthly article limit — no API keys to manage.",
      },
      {
        question: "How does autopilot work?",
        answer:
          "You pick a topic and a cadence. Writora brainstorms a cluster of article ideas for your site, then generates and publishes each post automatically on that schedule. Autopilot is available on Pro and Business.",
      },
      {
        question: "Where can I publish?",
        answer:
          "Every plan includes your own hosted blog. Pro and Business plans can also push posts to WordPress (via the Writora Connector plugin), cross-post to Dev.to, and auto-post to X.",
      },
    ],
  },
  {
    title: "Plans & billing",
    questions: [
      {
        question: "What counts as an AI article?",
        answer:
          "Each generated draft counts against your monthly limit, whether or not you end up publishing it.",
      },
      {
        question: "What happens when I hit my monthly limit?",
        answer:
          "AI generation pauses until the next month. You can keep writing and publishing manually in the meantime, or upgrade for a higher limit.",
      },
      {
        question: "Do unused articles roll over?",
        answer: "No. Limits reset at the start of each billing month.",
      },
      {
        question: "Can I cancel anytime?",
        answer:
          "Yes. Manage or cancel your subscription through the Stripe customer portal in your billing settings. You keep paid features until the end of the billing period.",
      },
    ],
  },
  {
    title: "Self-hosting",
    questions: [
      {
        question: "Is there a free self-hosted option?",
        answer:
          "Yes. The full codebase is open at github.com/krishna-paulraj/writora and ships with a Docker compose stack, so you can run the whole platform on your own infrastructure.",
      },
      {
        question: "Do custom domains work?",
        answer:
          "Yes. Point your DNS at the deployment and set the domain on your site. On the hosted service, custom domains are available on Pro and Business plans.",
      },
      {
        question: "Where does my data live?",
        answer:
          "When you self-host, everything — content, subscribers, analytics — lives in your own Postgres database, on your own servers.",
      },
    ],
  },
];

export const FAQ = ({
  headerTag = "h2",
  className,
  className2,
}: {
  headerTag?: "h1" | "h2";
  className?: string;
  className2?: string;
}) => {
  return (
    <section className={cn("py-28 lg:py-32", className)}>
      <div className="container max-w-5xl">
        <div className={cn("mx-auto grid gap-16 lg:grid-cols-2", className2)}>
          <div className="space-y-4">
            {headerTag === "h1" ? (
              <h1 className="text-2xl tracking-tight md:text-4xl lg:text-5xl">
                Got Questions?
              </h1>
            ) : (
              <h2 className="text-2xl tracking-tight md:text-4xl lg:text-5xl">
                Got Questions?
              </h2>
            )}
            <p className="text-muted-foreground max-w-md leading-snug lg:mx-auto">
              If you can&apos;t find what you&apos;re looking for,{" "}
              <Link href="/contact" className="underline underline-offset-4">
                get in touch
              </Link>
              .
            </p>
          </div>

          <div className="grid gap-6 text-start">
            {categories.map((category, categoryIndex) => (
              <div key={category.title}>
                <h3 className="text-muted-foreground border-b py-4">
                  {category.title}
                </h3>
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((item, i) => (
                    <AccordionItem key={i} value={`${categoryIndex}-${i}`}>
                      <AccordionTrigger>{item.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
