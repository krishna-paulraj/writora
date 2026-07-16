import type { Metadata } from "next";

import Terms from "./terms.mdx";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern the hosted Writora service: accounts, your content, AI output, billing, and self-hosting.",
};

const Page = () => {
  return (
    <section className="mx-auto max-w-2xl px-4 py-28 lg:pt-44 lg:pb-32">
      <article className="prose prose-lg dark:prose-invert">
        <Terms />
      </article>
    </section>
  );
};

export default Page;
