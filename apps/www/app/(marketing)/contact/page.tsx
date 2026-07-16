import React from "react";

import type { Metadata } from "next";

import { Background } from "@/components/background";
import Contact from "@/components/blocks/contact";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with Writora — questions about plans, billing, or self-hosting, plus bug reports and feature requests on GitHub.",
};

const Page = () => {
  return (
    <Background>
      <Contact />
    </Background>
  );
};

export default Page;
