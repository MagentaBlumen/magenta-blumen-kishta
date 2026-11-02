import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { settings, taxRate } from "@/db/schema/settings";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SystemHealthCard } from "@/components/admin/system-health-card";
import { fetchSystemHealth } from "@/lib/admin/system-health";
import { AnonymiseCustomerForm } from "./_components/anonymise-customer";
import { updateSettings } from "./actions";

// Keys that are logically numeric - render as type="number".
// If a key is missing from this set, it falls back to text.
// Keeping this list explicit (rather than deriving from the value)
// avoids "56 Ortschaften" being treated as a number.
const NUMERIC_KEYS = new Set<string>([
  "same_day_cutoff_hours",
  "max_booking_horizon_days",
  "run_generation_days",
  "timed_deliveries_per_hour",
  "global_min_order_gross",
  "free_delivery_over_gross",
  "soft_launch_daily_cap",
  "abandoned_order_minutes",
]);

type PageProps = {
  searchParams: Promise<{ ok?: string; dsg?: string }>;
};

export default async function EinstellungenPage({ searchParams }: PageProps) {
  const { ok, dsg } = await searchParams;

  const [settingRows, taxRateRows, health] = await Promise.all([
    db
      .select({
        key: settings.key,
        value: settings.value,
        descriptionDe: settings.descriptionDe,
        updatedAt: settings.updatedAt,
      })
      .from(settings)
      .orderBy(asc(settings.key)),
    db
      .select({
        id: taxRate.id,
        code: taxRate.code,
        nameDe: taxRate.nameDe,
        rate: taxRate.rate,
      })
      .from(taxRate)
      .orderBy(asc(taxRate.code)),
    fetchSystemHealth(),
  ]);

  return (
    <div className="space-y-10 max-w-3xl animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div>
        <p className="text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground font-medium mb-2">
          Shop
        </p>
        <h1 className="font-display font-light text-[clamp(1.8rem,3vw,2.4rem)] leading-tight">
          Einstellungen
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Konfiguration, die sich ohne Deploy ändern lässt. Änderungen greifen
          sofort.
        </p>
      </div>

      {ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 animate-in fade-in slide-in-from-top-1 duration-300">
          Gespeichert.
        </div>
      )}

      {/* -------- System health -------- */}
      <SystemHealthCard health={health} />

      {/* -------- Editable settings form -------- */}
      <form action={updateSettings} className="space-y-5">
        <div>
          <h2 className="font-display font-light text-xl leading-tight">
            Betriebsparameter
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Globale Zahlen (Cutoff-Stunden, Mindestbestellwert, Horizont).
            Treffen den ganzen Shop, nicht einzelne Produkte.
          </p>
        </div>
        <div className="space-y-5 rounded-lg border border-mist bg-card p-6">
          {settingRows.map((row) => {
            const isNumeric = NUMERIC_KEYS.has(row.key);
            return (
              <div
                key={row.key}
                className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-6 md:items-start"
              >
                <div className="space-y-0.5">
                  <Label htmlFor={`setting.${row.key}`} className="font-mono text-xs">
                    {row.key}
                  </Label>
                  {row.descriptionDe && (
                    <p className="text-xs text-muted-foreground">
                      {row.descriptionDe}
                    </p>
                  )}
                </div>
                <Input
                  id={`setting.${row.key}`}
                  name={`setting.${row.key}`}
                  type={isNumeric ? "number" : "text"}
                  step={isNumeric ? "any" : undefined}
                  defaultValue={row.value}
                  className="font-mono text-sm"
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className={`group ${buttonVariants()} inline-flex items-center gap-2 active:translate-y-px transition-all`}
          >
            Speichern
            <span className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </button>
        </div>
      </form>

      {/* -------- revFADP erasure -------- */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display font-light text-xl leading-tight">
            Datenschutz · Anonymisierung
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Anfrage nach Art. 32 revDSG. Löscht persönliche Felder des Kontos
            (Name, E-Mail, Telefon, Passwort). Bestellungen bleiben wegen der
            10-jährigen Aufbewahrungspflicht erhalten - mit den damals
            erfassten Daten als Snapshot.
          </p>
        </div>
        <div className="rounded-lg border border-mist bg-card p-6">
          {dsg === "ok" && (
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              Kundenkonto anonymisiert. Bestellungen unverändert.
            </div>
          )}
          {dsg === "notfound" && (
            <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Keine Kundin mit dieser E-Mail gefunden.
            </div>
          )}
          {dsg === "invalid" && (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Bitte gültige E-Mail-Adresse eingeben.
            </div>
          )}
          {dsg === "unconfirmed" && (
            <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Anonymisierung nicht bestätigt.
            </div>
          )}
          <AnonymiseCustomerForm />
        </div>
      </section>

      {/* -------- Read-only tax rates -------- */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display font-light text-xl leading-tight">
            MWST-Sätze
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Nur zur Ansicht. Änderungen erfordern Rücksprache mit dem
            Treuhänder · siehe <code className="text-xs font-mono">docs/vat-rates.md</code>.
          </p>
        </div>
        <div className="rounded-lg border border-mist overflow-hidden divide-y divide-mist bg-card">
          {taxRateRows.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div className="space-y-0.5">
                <div className="font-medium">{r.nameDe}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {r.code}
                </div>
              </div>
              {r.rate ? (
                <Badge variant="outline" className="tabular-nums">
                  {(Number(r.rate) * 100).toFixed(2)}%
                </Badge>
              ) : (
                <Badge variant="destructive">nicht gesetzt</Badge>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
