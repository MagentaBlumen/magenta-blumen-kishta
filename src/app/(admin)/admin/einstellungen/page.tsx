import Link from "next/link";
import { asc } from "drizzle-orm";
import { DateTime } from "luxon";
import { signOut } from "@/auth";
import { db } from "@/db/client";
import { settings, taxRate } from "@/db/schema/settings";
import { fetchSystemHealth } from "@/lib/admin/system-health";
import {
  SettingsForm,
  type StepperField,
} from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

const PRICE_FIELDS: StepperField[] = [
  {
    key: "free_delivery_over_gross",
    label: "Gratis-Lieferung ab",
    hint: "Darunter kostet die Lieferung.",
    unit: "CHF",
    step: 10,
    max: 1000,
  },
  {
    key: "global_min_order_gross",
    label: "Mindestbestellwert",
    hint: "Ohne Karte und Lieferung.",
    unit: "CHF",
    step: 5,
    max: 500,
  },
];

const TIME_FIELDS: StepperField[] = [
  {
    key: "same_day_cutoff_hours",
    label: "Bestellschluss vor der Tour",
    hint: "Tour 16:00 → bestellen bis",
    unit: "Stunden",
    step: 1,
    max: 24,
    showCutoffExample: true,
  },
  {
    key: "max_booking_horizon_days",
    label: "Im Voraus bestellen bis",
    unit: "Tage",
    step: 1,
    max: 365,
  },
  {
    key: "timed_deliveries_per_hour",
    label: "Anlass-Lieferungen",
    hint: "Mit fester Uhrzeit, z. B. Trauerfeiern.",
    unit: "pro Stunde",
    step: 1,
    max: 20,
  },
  {
    key: "soft_launch_daily_cap",
    label: "Online-Bestellungen",
    hint: "Höchstens so viele pro Tag.",
    unit: "pro Tag",
    step: 1,
    max: 500,
  },
];

const DEVELOPER_FIELDS: StepperField[] = [
  {
    key: "abandoned_order_minutes",
    label: "Unbezahlte Bestellung freigeben nach",
    unit: "Minuten",
    step: 5,
    max: 240,
    codeTag: "abandoned_order_minutes",
  },
  {
    key: "run_generation_days",
    label: "Touren im Voraus erstellen",
    unit: "Tage",
    step: 1,
    max: 365,
    codeTag: "run_generation_days",
  },
];

const ALL_FIELDS = [...PRICE_FIELDS, ...TIME_FIELDS, ...DEVELOPER_FIELDS];

const INITIAL_DEFAULTS: Record<string, string> = {
  free_delivery_over_gross: "120",
  global_min_order_gross: "40",
  same_day_cutoff_hours: "3",
  max_booking_horizon_days: "30",
  timed_deliveries_per_hour: "3",
  soft_launch_daily_cap: "5",
  abandoned_order_minutes: "30",
  run_generation_days: "60",
};

export default async function EinstellungenPage() {
  const [settingRows, taxRateRows, health] = await Promise.all([
    db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .orderBy(asc(settings.key)),
    db
      .select({
        code: taxRate.code,
        nameDe: taxRate.nameDe,
        rate: taxRate.rate,
      })
      .from(taxRate)
      .orderBy(asc(taxRate.code)),
    fetchSystemHealth(),
  ]);

  const settingsMap = new Map(settingRows.map((r) => [r.key, r.value ?? ""]));
  const initialValues: Record<string, string> = {};
  for (const f of ALL_FIELDS) {
    initialValues[f.key] = settingsMap.get(f.key) ?? INITIAL_DEFAULTS[f.key] ?? "";
  }

  const shopTimezone = settingsMap.get("shop_timezone") ?? "Europe/Zurich";
  const checks = buildChecks(health);
  const anyBad = checks.some((c) => !c.ok);

  return (
    <div className="adm-wrap adm-wrap--narrow">
      <div className="adm-head adm-head--solo">
        <div>
          <h1>Einstellungen</h1>
        </div>
      </div>

      {anyBad && (
        <div className="alert" role="alert">
          <svg
            className="icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 3l10 18H2z" />
            <path d="M12 10v5M12 18v.5" />
          </svg>
          <span>
            <strong>Einige Systeme sind nicht erreichbar.</strong>{" "}
            Details unter «Systemstatus und Technisches».
          </span>
        </div>
      )}

      <SettingsForm
        priceFields={PRICE_FIELDS}
        timeFields={TIME_FIELDS}
        developerFields={DEVELOPER_FIELDS}
        initialValues={initialValues}
        extraHidden={{ shop_timezone: shopTimezone }}
        moreChildren={
          <>
            <section className="set-group" aria-labelledby="g-status">
              <h2 id="g-status">Systemstatus</h2>
              <ul className="checks">
                {checks.map((c) => (
                  <li key={c.key}>
                    <span className={`ck${c.ok ? "" : " ck--bad"}`}>
                      {c.ok ? <TickIcon /> : <WarnIcon />}
                    </span>
                    <strong>{c.label}</strong>
                    <span className="hint">{c.detail}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="set-group" aria-labelledby="g-mwst">
              <h2 id="g-mwst">Mehrwertsteuer</h2>
              {taxRateRows.length === 0 ? (
                <p>Noch keine Sätze hinterlegt.</p>
              ) : (
                <p>
                  {taxRateRows
                    .map((t) => {
                      const pct =
                        t.rate != null
                          ? `${(Number(t.rate) * 100).toLocaleString("de-CH", {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })} %`
                          : "?";
                      return `${pct} ${t.nameDe}`;
                    })
                    .join(" · ")}
                </p>
              )}
            </section>
          </>
        }
      />

      {/* Mobile-only: shop link + logout (desktop has them in the sidebar). */}
      <nav className="links set-group" aria-label="Weiteres">
        <Link href="/" target="_blank" rel="noopener">
          <svg
            className="icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
          </svg>
          Shop ansehen
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button type="submit">
            <svg
              className="icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H9" />
            </svg>
            Abmelden
          </button>
        </form>
      </nav>
    </div>
  );
}

type Check = { key: string; label: string; detail: string; ok: boolean };

function buildChecks(
  health: Awaited<ReturnType<typeof fetchSystemHealth>>,
): Check[] {
  // Fix for 'letzte: Invalid DateTime': guard isValid before formatting.
  const latestDt = health.orders.latestOrderPlacedAt
    ? DateTime.fromJSDate(health.orders.latestOrderPlacedAt, {
        zone: "Europe/Zurich",
      }).setLocale("de-CH")
    : null;
  const latestLabel =
    latestDt && latestDt.isValid
      ? latestDt.toFormat("ccc d. LLL, HH:mm")
      : "noch keine";

  const latestRunDt = health.runs.latestRunDate
    ? DateTime.fromISO(health.runs.latestRunDate, {
        zone: "Europe/Zurich",
      }).setLocale("de-CH")
    : null;
  const latestRunLabel =
    latestRunDt && latestRunDt.isValid
      ? latestRunDt.toFormat("d. LLLL yyyy")
      : "noch keine";

  return [
    {
      key: "resend",
      label: "E-Mails",
      detail: health.integrations.resend ? "Resend" : "Resend fehlt",
      ok: health.integrations.resend,
    },
    {
      key: "stripe",
      label: "Zahlungen",
      detail: health.integrations.stripe ? "Stripe" : "Stripe fehlt",
      ok: health.integrations.stripe,
    },
    {
      key: "stripe-webhook",
      label: "Zahlungsbestätigungen",
      detail: health.integrations.stripeWebhook
        ? "Stripe Webhook"
        : "Stripe Webhook fehlt",
      ok: health.integrations.stripeWebhook,
    },
    {
      key: "sentry",
      label: "Fehlerprotokoll",
      detail: health.integrations.sentry ? "Sentry" : "Sentry fehlt",
      ok: health.integrations.sentry,
    },
    {
      key: "runs",
      label: "Liefertermine",
      detail: `bis ${latestRunLabel} · ${health.runs.daysAhead} Tage Vorlauf`,
      ok: health.runs.daysAhead >= 14,
    },
    {
      key: "orders",
      label: "Bestellungen",
      detail: `letzte: ${latestLabel}`,
      ok: true,
    },
  ];
}

function TickIcon() {
  return (
    <svg
      className="icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg
      className="icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 18v.5" />
    </svg>
  );
}
