import React from "react";

import type { Metadata } from "next";

import { Background } from "@/components/background";
import { FAQ } from "@/components/blocks/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about Writora: AI article generation, autopilot content plans, publishing destinations, plan limits, billing, and self-hosting.",
};

const Page = () => {
  return (
    <Background>
      <FAQ
        className="py-28 text-center lg:pt-44 lg:pb-32"
        className2="max-w-xl lg:grid-cols-1"
        headerTag="h1"
      />
    </Background>
  );
};

export default Page;
