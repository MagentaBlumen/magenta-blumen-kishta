// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a user loads a page in their
// browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://708ed51aa630ad924facf1517cc2fcff@o4512091801583616.ingest.de.sentry.io/4512091860762704",

  // Keep settings in sync with sentry.server.config.ts. See that file for
  // rationale (enabled, tracesSampleRate, sendDefaultPii under revFADP).
  //
  // On the client, Next.js replaces `process.env.NODE_ENV` at build time
  // with a literal string, so this becomes a compile-time constant and the
  // SDK is fully tree-shaken out of dev bundles.
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
