// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://708ed51aa630ad924facf1517cc2fcff@o4512091801583616.ingest.de.sentry.io/4512091860762704",

  // Do not send from local dev / test / CI builds. Prevents the SDK from
  // eating the free-tier quota while iterating locally. In prod, NODE_ENV
  // is "production" and the SDK activates.
  enabled: process.env.NODE_ENV === "production",

  // Sample 10% of transactions for performance. Free tier is 10k
  // transactions/month; 100% burns through in a day at real traffic.
  tracesSampleRate: 0.1,

  // ---------------------------------------------------------------------
  // PII / revFADP - leave sendDefaultPii FALSE.
  // ---------------------------------------------------------------------
  // The wizard default is TRUE, which attaches request headers (Cookie,
  // Authorization), user context (IP), and in some cases request bodies to
  // every error report. On checkout our requests carry recipient names,
  // addresses, phone numbers, card messages - all personal data under the
  // revised Swiss FADP. Sending that to a third-party processor without an
  // explicit legal basis is not acceptable.
  //
  // If a specific error genuinely needs extra context, attach it explicitly
  // via Sentry.setContext / setExtra AFTER redacting.
  sendDefaultPii: false,
});
