import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
  output: "standalone",
  outputFileTracingRoot: join(__dirname, "../../"),
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
