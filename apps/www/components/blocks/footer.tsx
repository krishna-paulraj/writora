import Link from "next/link";

import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";

const columns = [
  {
    title: "Product",
    links: [
      { name: "Features", href: "/#features" },
      { name: "Pricing", href: "/pricing" },
      { name: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { name: "About", href: "/about" },
      { name: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { name: "Privacy", href: "/privacy" },
      { name: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="flex flex-col items-center gap-14 pt-28 lg:pt-32">
      <div className="container space-y-3 text-center">
        <h2 className="text-2xl tracking-tight md:text-4xl lg:text-5xl">
          Own your content pipeline
        </h2>
        <p className="text-muted-foreground mx-auto max-w-xl leading-snug text-balance">
          Writora researches, writes, and publishes SEO content for your sites —
          hosted, or self-hosted on your own infrastructure.
        </p>
        <div>
          <Button size="lg" className="mt-4" asChild>
            <Link href="/signup">Start for free</Link>
          </Button>
        </div>
      </div>

      <nav className="container">
        <div className="mx-auto grid max-w-2xl grid-cols-2 gap-8 text-center sm:grid-cols-3 sm:text-start">
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-muted-foreground mb-3 text-sm font-medium tracking-wide">
                {column.title}
              </h3>
              <ul className="space-y-2">
                {column.links.map((item) => (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className="font-medium transition-opacity hover:opacity-75"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-muted-foreground mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <a
            href="https://github.com/krishna-paulraj/writora"
            target="_blank"
            rel="noopener"
            className="flex items-center gap-0.5 font-medium transition-opacity hover:opacity-75"
          >
            GitHub <ArrowUpRight className="size-4" />
          </a>
          <span>© {new Date().getFullYear()} Writora</span>
        </div>
      </nav>

      <div className="text-primary mt-10 w-full md:mt-14 lg:mt-20">
        <svg
          width="1570"
          height="293"
          viewBox="0 0 1570 293"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          <defs>
            <linearGradient
              id="paint0_linear_59_191"
              x1="785"
              y1="0"
              x2="785"
              y2="293"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="currentColor" />
              <stop offset="1" stopColor="#F8F8F8" stopOpacity="0.41" />
            </linearGradient>
          </defs>
          <text
            x="50%"
            y="320"
            textAnchor="middle"
            fill="url(#paint0_linear_59_191)"
            fontFamily="inherit"
            fontSize="320"
            fontWeight="500"
          >
            writora
          </text>
        </svg>
      </div>
    </footer>
  );
}
