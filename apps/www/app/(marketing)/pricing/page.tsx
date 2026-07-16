import React from "react";

import type { Metadata } from "next";

import { Background } from "@/components/background";
import { Pricing } from "@/components/blocks/pricing";
import { PricingTable } from "@/components/blocks/pricing-table";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start free with 1 site and 5 AI articles a month. Pro ($19/mo) adds keyword research, autopilot, and external publishing. Business ($49/mo) scales to 25 sites.",
};

const Page = () => {
  return (
    <Background>
      <Pricing className="py-28 text-center lg:pt-44 lg:pb-32" />
      <PricingTable />
    </Background>
  );
};

export default Page;
