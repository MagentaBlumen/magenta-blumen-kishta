import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit .next/standalone/ containing the server + minimal deps so the
  // production Docker image can copy that instead of the full node_modules.
  // Cuts image size ~10x. See Dockerfile.
  output: "standalone",

  // Sharp has native bindings (libvips). If webpack tries to bundle it,
  // the .node binary is dropped and the runtime import fails. Marking
  // it external forces Node to resolve it from node_modules at runtime.
  serverExternalPackages: ["sharp"],

  experimental: {
    serverActions: {
      // Default limit is 1 MB; product photos are commonly 2-8 MB each,
      // and we upload up to a handful at a time. 20 MB gives comfortable
      // headroom without letting someone abuse the endpoint to DoS us.
      bodySizeLimit: "20mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "magenta-blumen-kishta",

  project: "magenta-blumen-web",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
