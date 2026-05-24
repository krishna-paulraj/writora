import { join } from "node:path";
import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  output: "standalone",
  outputFileTracingRoot: join(import.meta.dirname, "../../"),
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
