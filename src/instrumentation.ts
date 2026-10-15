import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    // Log once at boot which env vars are missing. Prod-only; silent
    // in dev/test/CI so local work isn't noisy. See src/lib/env.ts.
    const { logEnvHealth } = await import("./lib/env");
    logEnvHealth();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
