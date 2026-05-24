import { join } from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Workspace root — required for Next to bundle monorepo deps into standalone
  outputFileTracingRoot: join(import.meta.dirname, "../../"),
};

export default nextConfig;
