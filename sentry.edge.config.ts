// This file configures the initialization of Sentry for edge features
// (middleware, edge routes, and so on). This config is unrelated to Vercel's
// Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://708ed51aa630ad924facf1517cc2fcff@o4512091801583616.ingest.de.sentry.io/4512091860762704",

  // Keep settings in sync with sentry.server.config.ts. See that file for
  // rationale (enabled, tracesSampleRate, sendDefaultPii under revFADP).
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
