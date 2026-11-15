import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { eq } from "drizzle-orm";
import { BestaetigenForm } from "@/components/storefront/bestaetigen-form";
import { CheckoutProgress } from "@/components/storefront/checkout-progress";
import { CoBox } from "@/components/storefront/co-box";
import { KasseSummary } from "@/components/storefront/kasse-summary";
import { db } from "@/db/client";
import { deliveryRun } from "@/db/schema/delivery";
import { hydrateCart } from "@/lib/cart/hydrate";
import { readCheckoutCookie } from "@/lib/checkout/cookie";
import { resolveZoneByPlzOrtschaft } from "@/lib/checkout/zones";
import { formatChf } from "@/lib/money";
import type { CheckoutCookie } from "@/lib/checkout/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasse . Bestätigung",
  robots: { index: false, follow: false },
};

// Step 3: display-only order summary + payment method + reserve.
//
// Everything shown here is server-derived to match what the reserve
// transaction will actually write. Numbers displayed and numbers
// inserted come from the same code path, so UI/receipt can't diverge.
//
// Gates:
//   - Empty cart -> /warenkorb
//   - Incomplete step 1 -> /kasse/lieferung
//   - Incomplete step 2 -> /kasse/lieferdaten
export default async function KasseBestaetigenPage() {
  const cart = await hydrateCart();
  if (cart.lines.length === 0) redirect("/warenkorb");

  const checkout = await readCheckoutCookie();

  const step1Done =
    checkout.plz &&
    checkout.ort &&
    checkout.zid &&
    checkout.ful &&
    (checkout.rid !== undefined || checkout.rda !== undefined);
  if (!step1Done) redirect("/kasse/lieferung");

  const step2Done =
    checkout.bn &&
    checkout.be &&
    checkout.bp &&
    checkout.rn &&
    checkout.st &&
    checkout.dc;
  if (!step2Done) redirect("/kasse/lieferdaten");

  const zone = await resolveZoneByPlzOrtschaft(checkout.plz!, checkout.ort!);
  if (!zone) redirect("/kasse/lieferung");

  const subtotalNum = Number(cart.subtotalGross);
  const belowMin = subtotalNum < Number(zone.minOrderGross);

  const slotLabel = await deriveSlotLabel(checkout);

  return (
    <main className="max-w-[1200px] mx-auto px-4 lg:px-8 py-8 lg:py-10 pb-24 flex flex-col gap-8">
      <CheckoutProgress current="bestaetigen" />

      <div className="flex flex-col gap-2.5">
        <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-rose">
          Kasse
        </p>
        <h1 className="m-0 font-display font-light text-bark text-[clamp(36px,4vw,52px)] leading-[1.05] tracking-[-0.025em]">
          Prüfen &amp; <em className="italic text-rose">bestellen</em>
        </h1>
      </div>

      {belowMin && (
        <p className="m-0 px-4 py-3 border border-rose/40 bg-rose/5 text-[13px] text-bark leading-[1.5]">
          Der Mindestbestellwert für {zone.zoneNameDe} liegt bei{" "}
          {formatChf(zone.minOrderGross)}. Bitte gehen Sie zurück zum Warenkorb
          und ergänzen Sie Ihre Bestellung.
        </p>
      )}

      <div className="flex flex-col lg:flex-row flex-wrap gap-10 lg:gap-14 items-start">
        <div className="w-full lg:flex-[7_1_520px] min-w-0 flex flex-col gap-4">
          <CoBox
            number={1}
            title="Ist alles richtig?"
            hint="Prüfen Sie Ihre Angaben – mit «Ändern» kommen Sie direkt zurück."
          >
            <ReviewRow label="Lieferung" editHref="/kasse/lieferung">
              <span className="text-[15px] text-bark">{slotLabel}</span>
              <span className="text-[13px] text-sage">
                {zone.plz} {zone.ortschaft} · Zone {zone.zoneNameDe}
              </span>
            </ReviewRow>

            <ReviewRow label="Empfänger" editHref="/kasse/lieferdaten">
              <span className="text-[15px] text-bark">{checkout.rn}</span>
              <span className="text-[15px] text-bark">
                {checkout.st}, {zone.plz} {zone.ortschaft}
              </span>
              <span className="text-[13px] text-sage">
                {deliveryContextLabelDe(checkout.dc ?? "residential")}
                {checkout.dc === "hospital" && checkout.dw
                  ? ` · Station ${checkout.dw}${checkout.dm ? `, Zimmer ${checkout.dm}` : ""}`
                  : ""}
                {checkout.dc === "funeral" && checkout.dn
                  ? ` · ${checkout.dn}`
                  : ""}
                {checkout.rp ? ` · ${checkout.rp}` : ""}
              </span>
            </ReviewRow>

            {checkout.cm && (
              <ReviewRow label="Grusskarte" editHref="/kasse/lieferdaten">
                <span className="font-display italic text-[16px] text-bark leading-[1.5]">
                  «{checkout.cm}»
                </span>
                {checkout.ca && (
                  <span className="text-[13px] text-sage">(anonym)</span>
                )}
              </ReviewRow>
            )}

            {checkout.di && (
              <ReviewRow label="Hinweise" editHref="/kasse/lieferdaten">
                <span className="text-[14px] text-bark leading-[1.5]">
                  {checkout.di}
                </span>
              </ReviewRow>
            )}

            <ReviewRow label="Ihre Angaben" editHref="/kasse/lieferdaten">
              <span className="text-[15px] text-bark">{checkout.bn}</span>
              <span className="text-[13px] text-sage">
                {checkout.be} · {checkout.bp}
              </span>
            </ReviewRow>
          </CoBox>

          {belowMin ? (
            <CoBox number={2} title="Bestellung blockiert">
              <p className="m-0 text-[14px] text-bark leading-[1.5]">
                Bitte erhöhen Sie den Bestellwert im Warenkorb, um fortzufahren.
              </p>
            </CoBox>
          ) : (
            <CoBox
              number={2}
              title="Wie möchten Sie bezahlen?"
              hint="Karte und TWINT bezahlen Sie direkt nach dem Bestellen."
            >
              <BestaetigenForm />
            </CoBox>
          )}

          <Link
            href="/kasse/lieferdaten"
            className="self-start mt-2 inline-flex items-center gap-2 text-[14px] font-semibold text-bark hover:text-rose transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            Zurück zu Ihren Angaben
          </Link>
        </div>

        <KasseSummary cart={cart} zone={zone} checkout={checkout} />
      </div>
    </main>
  );
}

function ReviewRow({
  label,
  editHref,
  children,
}: {
  label: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-4 py-4 border-t border-[#E6DDD2] first:border-t-0 first:pt-0">
      <span className="w-[120px] shrink-0 pt-0.5 text-[12px] font-semibold tracking-[0.1em] uppercase text-sage">
        {label}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">{children}</div>
      <Link
        href={editHref}
        className="shrink-0 self-start pt-0.5 underline text-[13px] text-sage hover:text-rose transition-colors"
      >
        Ändern
      </Link>
    </div>
  );
}

async function deriveSlotLabel(checkout: CheckoutCookie): Promise<string> {
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
    const dt = DateTime.fromISO(row.runDate, { zone: "Europe/Zurich" }).setLocale(
      "de-CH",
    );
    return `${dt.toFormat("cccc, d. LLLL")} · ${row.windowStart.slice(0, 5)}–${row.windowEnd.slice(0, 5)} Uhr`;
  }
  if (checkout.ful === "timed" && checkout.rda) {
    const dt = DateTime.fromISO(checkout.rda, { zone: "Europe/Zurich" }).setLocale(
      "de-CH",
    );
    return `${dt.toFormat("cccc, d. LLLL")} · Zeremonie um ${dt.toFormat("HH:mm")} Uhr`;
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
