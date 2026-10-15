import { DateTime } from "luxon";
import { Badge } from "@/components/ui/badge";
import type { SystemHealth } from "@/lib/admin/system-health";

/**
 * One-glance card for the top of /admin/einstellungen.
 *
 * Three sections:
 *   1. Liefertermine - is the generate-runs job keeping up?
 *      Red if we're inside 7 days of running out; the systemd timer
 *      runs nightly so a healthy install always has at least 30 days.
 *   2. Bestellungen - sanity-check that writes are flowing. If
 *      lastHourCount drops to 0 for an extended stretch while the shop
 *      is open, something's wrong upstream.
 *   3. Integrationen - which env vars are set at runtime.
 */

export function SystemHealthCard({ health }: { health: SystemHealth }) {
  const runsTone: "ok" | "warn" | "bad" =
    health.runs.daysAhead >= 14
      ? "ok"
      : health.runs.daysAhead >= 7
        ? "warn"
        : "bad";

  const latestRun = health.runs.latestRunDate
    ? DateTime.fromISO(health.runs.latestRunDate, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("ccc d. LLL yyyy")
    : "–";

  const latestOrder = health.orders.latestOrderPlacedAt
    ? DateTime.fromJSDate(health.orders.latestOrderPlacedAt, {
        zone: "Europe/Zurich",
      })
        .setLocale("de-CH")
        .toFormat("ccc d. LLL, HH:mm")
    : "–";

  return (
    <section className="rounded-lg border p-6 bg-card space-y-6">
      <div>
        <h2 className="text-lg font-medium">System</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Täglicher Vorlauf, Datenfluss und Integrationen. Alles grün = alles
          läuft.
        </p>
      </div>

      <dl className="grid gap-5 sm:grid-cols-3">
        <HealthBlock
          label="Liefertermine"
          primary={`${health.runs.daysAhead} Tage Vorlauf`}
          secondary={`letzter Lauf: ${latestRun}`}
          tone={runsTone}
          hint={
            runsTone === "bad"
              ? "generate-runs scheint nicht zu laufen - Systemd prüfen"
              : runsTone === "warn"
                ? "weniger als 2 Wochen Puffer - beobachten"
                : null
          }
        />
        <HealthBlock
          label="Bestellungen"
          primary={`${health.orders.totalCount} total`}
          secondary={`letzte: ${latestOrder}`}
          tone="ok"
          hint={
            health.orders.lastHourCount > 0
              ? `${health.orders.lastHourCount} in der letzten Stunde`
              : null
          }
        />
        <HealthBlock
          label="Offene Läufe"
          primary={`${health.runs.openRunsNext7Days} / 14`}
          secondary="nächste 7 Tage"
          tone={health.runs.openRunsNext7Days >= 10 ? "ok" : "warn"}
          hint={null}
        />
      </dl>

      <div className="pt-4 border-t">
        <h3 className="text-sm font-medium mb-3">Integrationen</h3>
        <ul className="grid gap-2 sm:grid-cols-2 text-sm">
          <IntegrationItem label="Stripe (Zahlungen)" ok={health.integrations.stripe} />
          <IntegrationItem
            label="Stripe Webhook"
            ok={health.integrations.stripeWebhook}
          />
          <IntegrationItem label="Resend (E-Mail)" ok={health.integrations.resend} />
          <IntegrationItem label="Sentry (Fehlerprotokoll)" ok={health.integrations.sentry} />
          <IntegrationItem label="Site-URL" ok={health.integrations.siteUrl} />
        </ul>
      </div>
    </section>
  );
}

function HealthBlock({
  label,
  primary,
  secondary,
  tone,
  hint,
}: {
  label: string;
  primary: string;
  secondary: string;
  tone: "ok" | "warn" | "bad";
  hint: string | null;
}) {
  const borderClass =
    tone === "bad"
      ? "border-rose-300"
      : tone === "warn"
        ? "border-amber-300"
        : "border-emerald-300";
  return (
    <div className={`rounded-md border-l-4 ${borderClass} bg-muted/30 px-3 py-2 space-y-0.5`}>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-base font-medium tabular-nums">{primary}</dd>
      <dd className="text-xs text-muted-foreground">{secondary}</dd>
      {hint && (
        <dd className="text-[0.72rem] text-rose-700 pt-1">{hint}</dd>
      )}
    </div>
  );
}

function IntegrationItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      {ok ? (
        <Badge variant="outline" className="text-emerald-700 border-emerald-300">
          konfiguriert
        </Badge>
      ) : (
        <Badge variant="destructive">fehlt</Badge>
      )}
    </li>
  );
}
