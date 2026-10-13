import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

// Content-Security-Policy for every page. Explicitly allowlists every
// external origin we talk to, so a hypothetical XSS can't exfiltrate
// to attacker-controlled hosts.
//
// 'unsafe-inline' on script-src and style-src is a pragmatic
// compromise: Next.js streams RSC payloads as inline <script> blocks
// and ships with inline styles. A nonce-based CSP would be stricter
// but requires per-request middleware + careful RSC coordination; not
// worth the moving parts at florist scale. The remaining directives
// still buy a meaningful attack-surface reduction.
//
// Caddy already sets HSTS, X-Content-Type-Options, X-Frame-Options,
// Referrer-Policy on every response - we don't duplicate those here.
const CSP = [
  "default-src 'self'",
  // Stripe: js.stripe.com for the Payment Element loader, m.stripe.network
  // for its own metrics calls. Sentry's own JS is self-hosted via our
  // monitoring tunnel route so no external script origin needed.
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.network",
  // Google Fonts stylesheet import lives in globals.css.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  // Product images come from R2 (any https host, since the public URL
  // uses pub-<hash>.r2.dev or a custom domain the owner may change).
  // data: + blob: for inline SVGs and image uploads during preview.
  "img-src 'self' data: blob: https:",
  // Stripe API + the Sentry ingest endpoint in Frankfurt (DE region).
  "connect-src 'self' https://api.stripe.com https://m.stripe.network https://*.ingest.de.sentry.io",
  // Stripe loads 3DS challenges + TWINT redirect UI inside iframes.
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network",
  "worker-src 'self' blob:",
  "base-uri 'self'",
  "form-action 'self'",
  // Prevent the site from being framed by other origins (clickjacking).
  // X-Frame-Options SAMEORIGIN in Caddy already covers this; this is
  // the modern CSP equivalent and takes precedence in modern browsers.
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

// Permissions-Policy locks down browser APIs we never use. If any of
// these ever appear in a page's needs, add the origin here - don't
// relax to '*'.
const PERMISSIONS_POLICY = [
  "geolocation=()",
  "microphone=()",
  "camera=()",
  "payment=(self https://js.stripe.com)",
  "fullscreen=(self)",
  "autoplay=()",
  "accelerometer=()",
  "gyroscope=()",
  "magnetometer=()",
].join(", ");

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

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
        ],
      },
    ];
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
