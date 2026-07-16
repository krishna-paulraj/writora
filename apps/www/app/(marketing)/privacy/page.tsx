import type { Metadata } from "next";

import Privacy from "./privacy.mdx";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What data Writora collects, how it is used, the subprocessors involved, and the choices you have.",
};

const Page = () => {
  return (
    <section className="mx-auto max-w-2xl px-4 py-28 lg:pt-44 lg:pb-32">
      <article className="prose prose-lg dark:prose-invert">
        <Privacy />
      </article>
    </section>
  );
};

export default Page;
