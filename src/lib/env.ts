import "server-only";

/**
 * Boot-time env sanity check.
 *
 * CLAUDE.md anticipated this: "Env access goes through one module so a
 * missing var fails at boot, not in the middle of a checkout."
 *
 * Deliberately a LOGGER, not a thrower:
 *   - CI build runs with dummy AUTH_SECRET and no DATABASE_URL; throwing
 *     would break CI and that produces more pain than value.
 *   - Dev often runs without Stripe or Resend; a hard crash is wrong.
 *   - Prod sees the warnings in the container log, surfaces up through
 *     Sentry breadcrumbs on next request, and the integration status is
 *     also visible in /admin/einstellungen's system card.
 *
 * We DO log loudly on prod (NODE_ENV=production) and stay quiet in dev
 * / test / CI so local work isn't flooded with yellow.
 */

type Classification = "critical" | "recommended";

type EnvVar = {
  name: string;
  classification: Classification;
  description: string;
};

const VARS: EnvVar[] = [
  // Critical: without these the app fundamentally misbehaves.
  {
    name: "DATABASE_URL",
    classification: "critical",
    description: "Postgres connection string",
  },
  {
    name: "AUTH_SECRET",
    classification: "critical",
    description: "NextAuth session signing + order-lookup token HMAC",
  },

  // Recommended: specific feature degrades without them.
  {
    name: "ADMIN_EMAIL",
    classification: "recommended",
    description: "admin login email (admin login disabled without)",
  },
  {
    name: "ADMIN_PASSWORD_HASH",
    classification: "recommended",
    description: "admin bcrypt hash (admin login disabled without)",
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    classification: "recommended",
    description: "canonical site URL for sitemap, OG, email links",
  },
  {
    name: "STRIPE_SECRET_KEY",
    classification: "recommended",
    description: "card + TWINT payments (cash + invoice still work without)",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    classification: "recommended",
    description: "verifies Stripe webhook signatures",
  },
  {
    name: "RESEND_API_KEY",
    classification: "recommended",
    description: "transactional emails (buyer + shop + status)",
  },
  {
    name: "RESEND_FROM_ADDRESS",
    classification: "recommended",
    description: "verified sender for Resend",
  },
];

export function logEnvHealth(): void {
  if (process.env.NODE_ENV !== "production") return;

  const missing = VARS.filter((v) => !process.env[v.name]);
  if (missing.length === 0) {
    console.log("[env] all env vars set");
    return;
  }

  const critical = missing.filter((m) => m.classification === "critical");
  if (critical.length > 0) {
    console.error(
      `[env] CRITICAL env vars missing: ${critical
        .map((c) => c.name)
        .join(", ")}. App will likely malfunction.`,
    );
  }

  const recommended = missing.filter((m) => m.classification === "recommended");
  if (recommended.length > 0) {
    console.warn(
      `[env] recommended env vars missing (feature(s) degrade): ${recommended
        .map((c) => `${c.name} (${c.description})`)
        .join("; ")}`,
    );
  }
}
