import { asc } from "drizzle-orm";
import { db } from "@/db/client";
import { settings, taxRate } from "@/db/schema/settings";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  searchParams: Promise<{ ok?: string }>;
};

export default async function EinstellungenPage({ searchParams }: PageProps) {
  const { ok } = await searchParams;

  const [settingRows, taxRateRows] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Konfiguration, die sich ohne Deploy ändern lässt. Änderungen greifen
          sofort.
        </p>
      </div>

      {ok && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Gespeichert.
        </div>
      )}

      {/* -------- Editable settings form -------- */}
      <form action={updateSettings} className="space-y-6">
        <h2 className="text-lg font-medium">Betriebsparameter</h2>
        <div className="space-y-5 rounded-lg border p-6 bg-card">
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
          <button type="submit" className={buttonVariants()}>
            Speichern
          </button>
        </div>
      </form>

      {/* -------- Read-only tax rates -------- */}
      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-medium">MWST-Sätze</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Nur zur Ansicht. Änderungen erfordern Rücksprache mit dem
            Treuhänder . siehe <code className="text-xs">docs/vat-rates.md</code>.
          </p>
        </div>
        <div className="rounded-lg border overflow-hidden divide-y">
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
