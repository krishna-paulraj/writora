import { Button } from "@/components/ui/button";

const About = () => {
  return (
    <section className="container mt-10 flex max-w-5xl flex-col gap-8 md:mt-14 md:gap-14 lg:mt-20 lg:flex-row lg:gap-20">
      <TextSection
        title="What Writora is"
        paragraphs={[
          "Writora started as a self-hostable blogging platform and grew into a full AI SEO content engine: keyword research from DataForSEO, OpenAI-backed article drafts with metadata and images, on-page SEO scoring, autopilot publishing, and a cross-site backlink network.",
          "Every site you create gets a themable public blog with the search plumbing — sitemaps, RSS, JSON-LD, OG images — handled for you. Posts can also go out to WordPress, Dev.to, and X.",
        ]}
      />
      <TextSection
        title="How it's built"
        paragraphs={[
          "It's built and maintained independently, in the open. There are no growth numbers or investor logos to show you — if you want to see how the project is doing, read the code and the commit history.",
          "If something is broken or missing, open an issue. That's genuinely the fastest way to change what gets built next.",
        ]}
        ctaButton={{
          href: "https://github.com/krishna-paulraj/writora",
          text: "View the code on GitHub",
        }}
      />
    </section>
  );
};

export default About;

interface TextSectionProps {
  title?: string;
  paragraphs: string[];
  ctaButton?: {
    href: string;
    text: string;
  };
}

export function TextSection({
  title,
  paragraphs,
  ctaButton,
}: TextSectionProps) {
  return (
    <div className="flex-1 space-y-4 text-lg md:space-y-6">
      {title && <h2 className="text-foreground text-4xl">{title}</h2>}
      <div className="text-muted-foreground max-w-xl space-y-6">
        {paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {ctaButton && (
        <div className="mt-8">
          <Button size="lg" asChild>
            <a href={ctaButton.href} target="_blank" rel="noopener">
              {ctaButton.text}
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}
