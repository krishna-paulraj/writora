import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  // Workspace root — required for Next to bundle monorepo deps into standalone
  outputFileTracingRoot: join(__dirname, "../../"),
};

export default nextConfig;
