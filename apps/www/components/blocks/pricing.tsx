import Link from "next/link";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "For your first site",
    features: [
      "1 site",
      "5 AI articles per month",
      "On-page SEO scoring",
      "Subscribers + newsletter",
      "Analytics, RSS, 40+ themes",
    ],
    cta: { label: "Start for free", href: "/signup" },
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    description: "For serious publishing",
    features: [
      "5 sites",
      "100 AI articles per month",
      "Keyword research",
      "Autopilot content plans",
      "10 publish destinations (WordPress, Dev.to, X)",
      "Custom domains",
      "Backlink network",
    ],
    cta: { label: "Start with Pro", href: "/signup?plan=pro" },
    highlight: true,
  },
  {
    name: "Business",
    price: "$49",
    description: "For agencies and portfolios",
    features: [
      "25 sites",
      "1,000 AI articles per month",
      "Everything in Pro",
      "100 publish destinations",
    ],
    cta: { label: "Start with Business", href: "/signup?plan=business" },
    highlight: false,
  },
];

export const Pricing = ({ className }: { className?: string }) => {
  return (
    <section className={cn("py-28 lg:py-32", className)}>
      <div className="container max-w-5xl">
        <div className="space-y-4 text-center">
          <h2 className="text-2xl tracking-tight md:text-4xl lg:text-5xl">
            Pricing
          </h2>
          <p className="text-muted-foreground mx-auto max-w-xl leading-snug text-balance">
            Start free with one site and five AI articles a month. Upgrade when
            you need keyword research, autopilot, and external publishing.
            Billed per account, not per user.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-5 text-start md:mt-12 md:grid-cols-3 lg:mt-20">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.highlight ? "outline-primary origin-top outline-4" : ""
              }
            >
              <CardContent className="flex flex-col gap-7 px-6 py-5">
                <div className="space-y-2">
                  <h3 className="text-foreground font-semibold">{plan.name}</h3>
                  <div className="space-y-1">
                    <div className="text-muted-foreground text-lg font-medium">
                      {plan.price}
                      {plan.name !== "Free" && (
                        <span className="text-muted-foreground">
                          {" "}
                          per month
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {plan.description}
                  </span>
                </div>

                <div className="space-y-3">
                  {plan.features.map((feature) => (
                    <div
                      key={feature}
                      className="text-muted-foreground flex items-center gap-1.5"
                    >
                      <Check className="size-5 shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-fit"
                  variant={plan.highlight ? "default" : "outline"}
                  asChild
                >
                  <Link href={plan.cta.href}>{plan.cta.label}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
