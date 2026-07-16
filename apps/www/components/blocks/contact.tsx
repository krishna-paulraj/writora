import React from "react";

import { ArrowUpRight } from "lucide-react";

import { ContactForm } from "@/components/blocks/contact-form";
import { DashedLine } from "@/components/dashed-line";

const contactInfo = [
  {
    title: "Bug reports & feature requests",
    content: (
      <p className="text-muted-foreground mt-3">
        Found a bug or want something built?{" "}
        <a
          href="https://github.com/krishna-paulraj/writora/issues"
          target="_blank"
          rel="noopener"
          className="text-foreground inline-flex items-center gap-0.5 underline underline-offset-4"
        >
          Open a GitHub issue <ArrowUpRight className="size-4" />
        </a>
      </p>
    ),
  },
  {
    title: "Everything else",
    content: (
      <p className="text-muted-foreground mt-3">
        Questions about plans, billing, or self-hosting — use the form below and
        we&apos;ll get back to you.
      </p>
    ),
  },
];

export default function Contact() {
  return (
    <section className="py-28 lg:py-32 lg:pt-44">
      <div className="container max-w-2xl">
        <h1 className="text-center text-2xl font-semibold tracking-tight md:text-4xl lg:text-5xl">
          Contact us
        </h1>
        <p className="text-muted-foreground mt-4 text-center leading-snug font-medium lg:mx-auto">
          Send a message and we&apos;ll get back to you.
        </p>

        <div className="mt-10 flex justify-between gap-8 max-sm:flex-col md:mt-14 lg:mt-20 lg:gap-12">
          {contactInfo.map((info, index) => (
            <div key={index} className="flex-1">
              <h2 className="font-medium">{info.title}</h2>
              {info.content}
            </div>
          ))}
        </div>

        <DashedLine className="my-12" />

        {/* Inquiry Form */}
        <div className="mx-auto">
          <h2 className="mb-4 text-lg font-semibold">Inquiries</h2>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
