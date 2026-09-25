import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BestaetigenForm } from "@/components/storefront/bestaetigen-form";
import { hydrateCart } from "@/lib/cart/hydrate";
import { readCheckoutCookie } from "@/lib/checkout/cookie";
import { resolveZoneByPlzOrtschaft } from "@/lib/checkout/zones";
import { resolveDeliveryTaxRate } from "@/lib/checkout/tax";
import { formatChf } from "@/lib/money";
import { DateTime } from "luxon";
import { db } from "@/db/client";
import { deliveryRun } from "@/db/schema/delivery";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasse . Bestätigung",
  robots: { index: false, follow: false },
};

/**
 * Step 3: display-only order summary + payment method + reserve.
 *
 * Everything shown here is server-derived to match what the reserve
 * transaction (5f-part-1) will actually write. Numbers displayed and
 * the numbers inserted come from the same code paths, so a mismatch
 * between UI and receipt can't happen through this page.
 *
 * Gates:
 *   - Empty cart -> /warenkorb
 *   - Incomplete step 1 -> /kasse/lieferung
 *   - Incomplete step 2 -> /kasse/lieferdaten
 */
export default async function KasseBestaetigenPage() {
  const cart = await hydrateCart();
  if (cart.lines.length === 0) redirect("/warenkorb");

  const checkout = await readCheckoutCookie();

  const step1Done =
    checkout.plz && checkout.ort && checkout.zid && checkout.ful &&
    (checkout.rid !== undefined || checkout.rda !== undefined);
  if (!step1Done) redirect("/kasse/lieferung");

  const step2Done =
    checkout.bn && checkout.be && checkout.bp && checkout.rn && checkout.st && checkout.dc;
  if (!step2Done) redirect("/kasse/lieferdaten");

  const zone = await resolveZoneByPlzOrtschaft(checkout.plz!, checkout.ort!);
  if (!zone) redirect("/kasse/lieferung");

  // Money: mirror the reserve transaction exactly.
  const subtotalNum = Number(cart.subtotalGross);
  const zoneFeeNum = Number(zone.feeGross);
  const freeOverNum = zone.freeOverGross != null ? Number(zone.freeOverGross) : null;
  const deliveryFeeNum =
    freeOverNum != null && subtotalNum >= freeOverNum ? 0 : zoneFeeNum;
  const totalNum = Math.round((subtotalNum + deliveryFeeNum) * 100) / 100;
  const belowMin = subtotalNum < Number(zone.minOrderGross);

  // Delivery-fee tax rate for display (server-side derivation).
  const feeTaxRate = resolveDeliveryTaxRate(
    cart.lines.map((l) => ({ taxRate: null, lineTotalGross: l.lineTotalGross })),
  );

  // Slot label. For run: fetch the run row for date + window. For timed:
  // format the ISO in Europe/Zurich.
  const slotLabel = await deriveSlotLabel(checkout);

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-10 lg:py-14">
      <CheckoutStepHeader step={3} />

      {belowMin && (
        <div className="mt-6 px-4 py-3 border border-rose/30 bg-rose/5 text-[0.85rem] text-bark leading-[1.55]">
          Der Mindestbestellwert für {zone.zoneNameDe} liegt bei{" "}
          {formatChf(zone.minOrderGross)}. Bitte gehen Sie zurück zum
          Warenkorb und ergänzen Sie Ihre Bestellung.
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px] items-start">
        <div className="space-y-6">
          {/* Lieferadresse */}
          <SummarySection
            title="Lieferung"
            editHref="/kasse/lieferung"
          >
            <div>
              {zone.plz} {zone.ortschaft} . Zone {zone.zoneNameDe}
            </div>
            <div>{slotLabel}</div>
          </SummarySection>

          {/* Empfänger */}
          <SummarySection
            title="Empfänger und Angaben"
            editHref="/kasse/lieferdaten"
          >
            <div>{checkout.rn}</div>
            <div>{checkout.st}</div>
            {checkout.rp && <div>Tel. {checkout.rp}</div>}
            <div className="pt-1 text-[0.72rem] uppercase tracking-[0.08em] text-sage">
              Kontext: {deliveryContextLabelDe(checkout.dc ?? "residential")}
            </div>
            {checkout.dc === "hospital" && checkout.dw && (
              <div className="pt-1">
                Station: {checkout.dw}
                {checkout.dm ? ` . Zimmer ${checkout.dm}` : ""}
              </div>
            )}
            {checkout.dc === "funeral" && (
              <>
                {checkout.dn && <div className="pt-1">Verstorbene Person: {checkout.dn}</div>}
                {checkout.fc && <div>Familienkontakt: {checkout.fc}</div>}
              </>
            )}
            {checkout.cm && (
              <div className="pt-2 text-[0.75rem] italic text-bark/80 border-t border-mist mt-2">
                «{checkout.cm}»{checkout.ca ? " (anonym)" : ""}
              </div>
            )}
            {checkout.di && (
              <div className="pt-1 text-[0.72rem] text-sage">
                Hinweise: {checkout.di}
              </div>
            )}
          </SummarySection>

          {/* Käufer */}
          <SummarySection title="Rechnungsempfänger" editHref="/kasse/lieferdaten">
            <div>{checkout.bn}</div>
            <div>{checkout.be}</div>
            <div>{checkout.bp}</div>
          </SummarySection>

          {/* Artikel */}
          <SummarySection title="Artikel" editHref="/warenkorb">
            <ul className="space-y-2">
              {cart.lines.map((l) => (
                <li
                  key={`${l.productId}:${l.variantId}`}
                  className="flex justify-between gap-4 text-[0.85rem]"
                >
                  <span className="text-bark">
                    {l.qty} × {l.productNameDe}
                    {l.variantLabelDe ? ` (${l.variantLabelDe})` : ""}
                  </span>
                  <span className="tabular-nums">{formatChf(l.lineTotalGross)}</span>
                </li>
              ))}
            </ul>
          </SummarySection>
        </div>

        <aside className="bg-cream border border-mist p-6 lg:sticky lg:top-24 space-y-4">
          <h2 className="text-[0.68rem] tracking-[0.2em] uppercase font-medium text-bark">
            Zusammenfassung
          </h2>
          <dl className="space-y-2 text-[0.9rem]">
            <Row label="Zwischensumme" value={formatChf(subtotalNum.toFixed(2))} />
            <Row
              label="Lieferung"
              value={deliveryFeeNum === 0 ? "gratis" : formatChf(deliveryFeeNum.toFixed(2))}
            />
            {feeTaxRate && (
              <p className="text-[0.7rem] text-sage">
                Lieferung inkl. MwSt. ({(Number(feeTaxRate) * 100).toFixed(1)}%)
              </p>
            )}
          </dl>
          <div className="pt-4 border-t border-mist flex items-baseline justify-between">
            <span className="text-[0.72rem] tracking-[0.12em] uppercase font-medium text-bark">
              Total
            </span>
            <span className="font-display text-[1.5rem] text-bark tabular-nums">
              {formatChf(totalNum.toFixed(2))}
            </span>
          </div>
          <p className="text-[0.7rem] text-sage leading-[1.55]">
            Alle Preise inkl. MwSt.
          </p>

          <div className="pt-4 border-t border-mist">
            {belowMin ? (
              <div className="text-[0.8rem] text-sage">
                Bestellung nicht möglich: Mindestbestellwert nicht erreicht.
              </div>
            ) : (
              <BestaetigenForm />
            )}
          </div>
        </aside>
      </div>

      <div className="mt-10 text-[0.72rem] tracking-[0.08em] uppercase">
        <Link
          href="/kasse/lieferdaten"
          className="text-sage hover:text-rose transition-colors"
        >
          ← Zurück zu Ihren Daten
        </Link>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------

async function deriveSlotLabel(
  checkout: Awaited<ReturnType<typeof readCheckoutCookie>>,
): Promise<string> {
  if (checkout.ful === "run" && checkout.rid) {
    const [row] = await db
      .select({
        runDate: deliveryRun.runDate,
        windowStart: deliveryRun.windowStart,
        windowEnd: deliveryRun.windowEnd,
      })
      .from(deliveryRun)
      .where(eq(deliveryRun.id, checkout.rid))
      .limit(1);
    if (!row) return "Termin nicht mehr verfügbar";
    const dt = DateTime.fromISO(row.runDate, { zone: "Europe/Zurich" }).setLocale("de-CH");
    return `${dt.toFormat("cccc d. LLLL")} . ${row.windowStart.slice(0, 5)}–${row.windowEnd.slice(0, 5)} Uhr`;
  }
  if (checkout.ful === "timed" && checkout.rda) {
    const dt = DateTime.fromISO(checkout.rda, { zone: "Europe/Zurich" }).setLocale("de-CH");
    return `${dt.toFormat("cccc d. LLLL")} . ${dt.toFormat("HH:mm")} Uhr (Zeremonie)`;
  }
  return "Kein Termin gewählt";
}

function deliveryContextLabelDe(dc: string): string {
  switch (dc) {
    case "residential":
      return "Privatadresse";
    case "business":
      return "Firma / Büro";
    case "hospital":
      return "Spital";
    case "funeral":
      return "Trauerort";
    default:
      return dc;
  }
}

function SummarySection({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-mist p-4">
      <div className="flex justify-between items-baseline mb-2">
        <h3 className="text-[0.68rem] tracking-[0.16em] uppercase font-medium text-bark">
          {title}
        </h3>
        <Link
          href={editHref}
          className="text-[0.7rem] tracking-[0.08em] uppercase text-sage hover:text-rose transition-colors"
        >
          Ändern
        </Link>
      </div>
      <div className="text-[0.85rem] text-bark leading-[1.55] space-y-1">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-sage">{label}</dt>
      <dd className="text-bark tabular-nums font-medium">{value}</dd>
    </div>
  );
}

function CheckoutStepHeader({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Lieferung" },
    { n: 2, label: "Ihre Daten" },
    { n: 3, label: "Bestätigen" },
  ];
  return (
    <>
      <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium mb-2">
        Kasse . Schritt {step} von 3
      </p>
      <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
        Bitte überprüfen und bestätigen
      </h1>
      <ol className="mt-6 flex gap-4 text-[0.72rem] tracking-[0.1em] uppercase font-medium">
        {steps.map((s) => {
          const isCurrent = s.n === step;
          const isPast = s.n < step;
          return (
            <li
              key={s.n}
              className={`flex items-center gap-2 ${
                isCurrent ? "text-bark" : isPast ? "text-bark/60" : "text-sage"
              }`}
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 border ${
                  isCurrent
                    ? "border-bark bg-bark text-ivory"
                    : isPast
                      ? "border-bark/40 text-bark/60"
                      : "border-mist text-sage"
                }`}
              >
                {s.n}
              </span>
              <span>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </>
  );
}
