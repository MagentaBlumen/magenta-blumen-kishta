import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone/ containing the server + minimal deps so the
  // production Docker image can copy that instead of the full node_modules.
  // Cuts image size ~10x. See Dockerfile.
  output: "standalone",
};

export default nextConfig;
