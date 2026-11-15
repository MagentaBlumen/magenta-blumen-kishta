import { asc } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db/client";
import { settings, taxRate } from "@/db/schema/settings";
import { fetchSystemHealth } from "@/lib/admin/system-health";
import {
  SettingsForm,
  type StepperField,
} from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

// Setting keys surfaced on this page. Any key not listed gets ignored
// by the form (it's kept in the DB but not editable here).
const SHOP_FIELDS: StepperField[] = [
  {
    key: "free_delivery_over_gross",
    label: "Gratis-Lieferung ab",
    unit: "CHF",
    step: 10,
    max: 1000,
    initial: "120",
  },
  {
    key: "global_min_order_gross",
    label: "Mindestbestellwert",
    hint: "Ohne Karte und Lieferung.",
    unit: "CHF",
    step: 5,
    max: 500,
    initial: "40",
  },
  {
    key: "same_day_cutoff_hours",
    label: "Bestellschluss vor der Tour",
    hint: "Tour um 16:00 → bestellen bis",
    unit: "Stunden",
    step: 1,
    max: 24,
    initial: "3",
    showCutoffExample: true,
  },
  {
    key: "max_booking_horizon_days",
    label: "Im Voraus bestellen bis",
    unit: "Tage",
    step: 1,
    max: 365,
    initial: "30",
  },
  {
    key: "timed_deliveries_per_hour",
    label: "Max. Anlass-Lieferungen",
    hint: "Mit fester Uhrzeit, z. B. Trauerfeiern.",
    unit: "pro Stunde",
    step: 1,
    max: 20,
    initial: "3",
  },
  {
    key: "soft_launch_daily_cap",
    label: "Max. Online-Bestellungen",
    unit: "pro Tag",
    step: 1,
    max: 500,
    initial: "5",
  },
];

const DEVELOPER_FIELDS: StepperField[] = [
  {
    key: "abandoned_order_minutes",
    label: "Unbezahlte Bestellung freigeben nach",
    unit: "Minuten",
    step: 5,
    max: 240,
    initial: "30",
    codeTag: "abandoned_order_minutes",
  },
  {
    key: "run_generation_days",
    label: "Touren im Voraus erstellen",
    unit: "Tage",
    step: 1,
    max: 365,
    initial: "60",
    codeTag: "run_generation_days",
  },
];

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
  for (const f of [...SHOP_FIELDS, ...DEVELOPER_FIELDS]) {
    initialValues[f.key] = settingsMap.get(f.key) ?? f.initial;
  }

  const shopTimezone = settingsMap.get("shop_timezone") ?? "Europe/Zurich";
  const checks = buildChecks(health);
  const anyBad = checks.some((c) => !c.ok);

  return (
    <>
      <div className="adm-head">
        <div className="adm-head__text">
          <h1 className="adm-title">Einstellungen</h1>
        </div>
      </div>

      {anyBad && (
        <div className="alert" role="alert">
          <svg
            className="icon"
            width="22"
            height="22"
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
            Details unter «Weitere Angaben».
          </span>
        </div>
      )}

      <SettingsForm
        shopFields={SHOP_FIELDS}
        developerFields={DEVELOPER_FIELDS}
        initialValues={initialValues}
        extraHidden={{ shop_timezone: shopTimezone }}
        moreChildren={
          <>
            <div>
              <h2>Systemstatus</h2>
              <ul className="checks">
                {checks.map((c) => (
                  <li key={c.key} className={c.ok ? undefined : "is-bad"}>
                    <span className="checks__mark">
                      {c.ok ? <TickIcon /> : <WarnIcon />}
                    </span>
                    <span>
                      <strong>{c.label}</strong>{" "}
                      <span>· {c.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>Mehrwertsteuer</h2>
              {taxRateRows.length === 0 ? (
                <p className="hint">Noch keine Sätze hinterlegt.</p>
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
            </div>
          </>
        }
      />
    </>
  );
}

type Check = { key: string; label: string; detail: string; ok: boolean };

// All system checks displayed under "Weitere Angaben". The red alert at
// the top of the page fires if any of these return ok=false.
function buildChecks(health: Awaited<ReturnType<typeof fetchSystemHealth>>): Check[] {
  // Fix for the 'letzte: Invalid DateTime' bug: fromJSDate can produce
  // an invalid DateTime if the source Date is NaN or the timezone
  // resolver fails. Guard with .isValid before formatting.
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
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
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
      width="16"
      height="16"
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
