"use client";

import { useState } from "react";

import Link from "next/link";

import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface FeatureSection {
  category: string;
  features: {
    name: string;
    free: true | false | null | string;
    pro: true | false | null | string;
    business: true | false | null | string;
  }[];
}

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    button: {
      text: "Start for free",
      href: "/signup",
      variant: "outline" as const,
    },
  },
  {
    name: "Pro",
    price: "$19/mo",
    button: {
      text: "Start with Pro",
      href: "/signup?plan=pro",
      variant: "default" as const,
    },
  },
  {
    name: "Business",
    price: "$49/mo",
    button: {
      text: "Start with Business",
      href: "/signup?plan=business",
      variant: "outline" as const,
    },
  },
];

const comparisonFeatures: FeatureSection[] = [
  {
    category: "Usage",
    features: [
      {
        name: "Sites",
        free: "1",
        pro: "5",
        business: "25",
      },
      {
        name: "AI articles per month",
        free: "5",
        pro: "100",
        business: "1,000",
      },
      {
        name: "Publish destinations (WordPress, Dev.to, X)",
        free: false,
        pro: "10",
        business: "100",
      },
    ],
  },
  {
    category: "Features",
    features: [
      {
        name: "Keyword research",
        free: false,
        pro: true,
        business: true,
      },
      {
        name: "SEO scoring",
        free: true,
        pro: true,
        business: true,
      },
      {
        name: "Autopilot content plans",
        free: false,
        pro: true,
        business: true,
      },
      {
        name: "Custom domains",
        free: false,
        pro: true,
        business: true,
      },
      {
        name: "Backlink network",
        free: false,
        pro: true,
        business: true,
      },
      {
        name: "Email subscribers + newsletter",
        free: true,
        pro: true,
        business: true,
      },
      {
        name: "Analytics",
        free: true,
        pro: true,
        business: true,
      },
    ],
  },
];

const renderFeatureValue = (value: true | false | null | string) => {
  if (value === true) {
    return <Check className="size-5" />;
  }
  if (value === false) {
    return <X className="text-muted-foreground size-5" />;
  }
  if (value === null) {
    return null;
  }
  // String value
  return (
    <div className="flex items-center gap-2">
      <Check className="size-4" />
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
};

export const PricingTable = () => {
  const [selectedPlan, setSelectedPlan] = useState(1); // Default to Pro plan

  return (
    <section className="pb-28 lg:py-32">
      <div className="container">
        <PlanHeaders
          selectedPlan={selectedPlan}
          onPlanChange={setSelectedPlan}
        />
        <FeatureSections selectedPlan={selectedPlan} />
      </div>
    </section>
  );
};

const PlanHeaders = ({
  selectedPlan,
  onPlanChange,
}: {
  selectedPlan: number;
  onPlanChange: (index: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      {/* Mobile View */}
      <div className="md:hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center justify-between border-b py-4">
            <CollapsibleTrigger className="flex items-center gap-2">
              <h3 className="text-2xl font-semibold">
                {pricingPlans[selectedPlan].name}
              </h3>
              <span className="text-muted-foreground text-sm">
                {pricingPlans[selectedPlan].price}
              </span>
              <ChevronsUpDown
                className={`size-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </CollapsibleTrigger>
            <Button
              variant={pricingPlans[selectedPlan].button.variant}
              className="w-fit"
              asChild
            >
              <Link href={pricingPlans[selectedPlan].button.href}>
                {pricingPlans[selectedPlan].button.text}
              </Link>
            </Button>
          </div>
          <CollapsibleContent className="flex flex-col space-y-2 p-2">
            {pricingPlans.map(
              (plan, index) =>
                index !== selectedPlan && (
                  <Button
                    size="lg"
                    variant="secondary"
                    key={index}
                    onClick={() => {
                      onPlanChange(index);
                      setIsOpen(false);
                    }}
                  >
                    {plan.name}
                  </Button>
                ),
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Desktop View */}
      <div className="grid grid-cols-4 gap-4 max-md:hidden">
        <div className="col-span-1 max-md:hidden"></div>

        {pricingPlans.map((plan, index) => (
          <div key={index}>
            <h3 className="mb-1 text-2xl font-semibold">{plan.name}</h3>
            <p className="text-muted-foreground mb-3 text-sm">{plan.price}</p>
            <Button variant={plan.button.variant} asChild>
              <Link href={plan.button.href}>{plan.button.text}</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const FeatureSections = ({ selectedPlan }: { selectedPlan: number }) => (
  <>
    {comparisonFeatures.map((section, sectionIndex) => (
      <div key={sectionIndex}>
        <div className="border-primary/40 border-b py-4">
          <h3 className="text-lg font-semibold">{section.category}</h3>
        </div>
        {section.features.map((feature, featureIndex) => (
          <div
            key={featureIndex}
            className="text-foreground grid grid-cols-2 font-medium max-md:border-b md:grid-cols-4"
          >
            <span className="inline-flex items-center py-4">
              {feature.name}
            </span>
            {/* Mobile View - Only Selected Plan */}
            <div className="md:hidden">
              <div className="flex items-center gap-1 py-4 md:border-b">
                {renderFeatureValue(
                  [feature.free, feature.pro, feature.business][selectedPlan],
                )}
              </div>
            </div>
            {/* Desktop View - All Plans */}
            <div className="hidden md:col-span-3 md:grid md:grid-cols-3 md:gap-4">
              {[feature.free, feature.pro, feature.business].map((value, i) => (
                <div key={i} className="flex items-center gap-1 border-b py-4">
                  {renderFeatureValue(value)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ))}
  </>
);
