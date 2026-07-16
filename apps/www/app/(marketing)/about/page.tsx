import type { Metadata } from "next";

import { Background } from "@/components/background";
import About from "@/components/blocks/about";
import { AboutHero } from "@/components/blocks/about-hero";

export const metadata: Metadata = {
  title: "About",
  description:
    "Writora is an independent, open-codebase project building an AI SEO content engine you can self-host and own.",
};

export default function AboutPage() {
  return (
    <Background>
      <div className="py-28 lg:py-32 lg:pt-44">
        <AboutHero />
        <About />
      </div>
    </Background>
  );
}
