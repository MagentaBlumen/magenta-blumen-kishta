import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutProgress } from "@/components/storefront/checkout-progress";
import { CoBox } from "@/components/storefront/co-box";
import { FulfilmentPicker } from "@/components/storefront/fulfilment-picker";
import { KasseSummary } from "@/components/storefront/kasse-summary";
import { PlzForm } from "@/components/storefront/plz-form";
import { ResetCheckoutButton } from "@/components/storefront/reset-checkout-button";
import { RunSlotPicker } from "@/components/storefront/run-slot-picker";
import { TimedSlotPicker } from "@/components/storefront/timed-slot-picker";
import { readCheckoutCookie } from "@/lib/checkout/cookie";
import {
  getAvailableRunSlots,
  getAvailableTimedSlots,
} from "@/lib/checkout/slots";
import { lookupPlz, resolveZoneByPlzOrtschaft } from "@/lib/checkout/zones";
import { hydrateCart } from "@/lib/cart/hydrate";
import { formatChf } from "@/lib/money";
import type { CheckoutCookie, ResolvedZone } from "@/lib/checkout/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasse . Lieferung",
  robots: { index: false, follow: false },
};

// Checkout step 1: PLZ resolution + slot pick.
//
// Empty cart -> back to /warenkorb.
// No PLZ -> PLZ input.
// PLZ set but ambiguous (5415) and no Ortschaft -> picker.
// Zone resolved -> resolved card + fulfilment radio + slot picker.
export default async function KasseLieferungPage() {
  const cart = await hydrateCart();
  if (cart.lines.length === 0) {
    redirect("/warenkorb");
  }

  const checkout = await readCheckoutCookie();

  let mode: "enter-plz" | "pick-ortschaft" | "zone-resolved";
  let pickerOptions: Awaited<ReturnType<typeof lookupPlz>> | null = null;
  let resolvedZone: ResolvedZone | null = null;

  if (checkout.plz && checkout.ort && checkout.zid) {
    resolvedZone = await resolveZoneByPlzOrtschaft(checkout.plz, checkout.ort);
    mode = resolvedZone ? "zone-resolved" : "enter-plz";
  } else if (checkout.plz) {
    pickerOptions = await lookupPlz(checkout.plz);
    mode = pickerOptions.kind === "picker" ? "pick-ortschaft" : "enter-plz";
  } else {
    mode = "enter-plz";
  }

  const runSlotDays =
    mode === "zone-resolved" && checkout.ful === "run"
      ? await getAvailableRunSlots()
      : null;
  const timedSlotDays =
    mode === "zone-resolved" && checkout.ful === "timed"
      ? await getAvailableTimedSlots()
      : null;

  const slotChosen = isSlotChosen(checkout);

  return (
    <main className="max-w-[1200px] mx-auto px-4 lg:px-8 py-8 lg:py-10 pb-24 flex flex-col gap-8">
      <CheckoutProgress current="lieferung" />

      <div className="flex flex-col gap-2.5">
        <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-rose">
          Kasse
        </p>
        <h1 className="m-0 font-display font-light text-bark text-[clamp(36px,4vw,52px)] leading-[1.05] tracking-[-0.025em]">
          Wohin und <em className="italic text-rose">wann?</em>
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row flex-wrap gap-10 lg:gap-14 items-start">
        <div className="w-full lg:flex-[7_1_520px] min-w-0 flex flex-col gap-4">
          <CoBox
            number={1}
            title="Wohin geht die Lieferung?"
            hint="Wir liefern selbst – in 27 Postleitzahlen im Aargau."
          >
            {mode === "enter-plz" && <PlzForm />}
            {mode === "pick-ortschaft" &&
              pickerOptions?.kind === "picker" && (
                <PlzForm initialPlz={checkout.plz!} />
              )}
            {mode === "zone-resolved" && resolvedZone && (
              <ResolvedZoneBody
                zone={resolvedZone}
                cartSubtotalGross={cart.subtotalGross}
              />
            )}
          </CoBox>

          {mode === "zone-resolved" && resolvedZone && (
            <CoBox
              number={2}
              title="Wann sollen die Blumen ankommen?"
              hint="Zuerst die Lieferart wählen, dann das Zeitfenster."
            >
              <FulfilmentPicker
                value={checkout.ful === "pickup" ? undefined : checkout.ful}
              />
              {checkout.ful === "run" && runSlotDays && (
                <SlotSection
                  label="Verfügbare Termine"
                  description="Zwei Touren täglich mit unserem eigenen Van. Cutoff 3 Stunden vor Beginn (dienstags 24 Stunden)."
                >
                  <RunSlotPicker
                    days={runSlotDays}
                    selectedRunId={checkout.rid}
                  />
                </SlotSection>
              )}
              {checkout.ful === "timed" && timedSlotDays && (
                <SlotSection
                  label="Zeitpunkt wählen"
                  description="Für Abdankungen, Hochzeiten und Anlässe mit fester Uhrzeit. Wir liefern rechtzeitig vor dem Termin."
                >
                  <TimedSlotPicker
                    days={timedSlotDays}
                    selectedIso={checkout.rda}
                  />
                </SlotSection>
              )}
            </CoBox>
          )}

          <div className="flex flex-col gap-3.5 pt-2">
            {slotChosen && (
              <Link
                href="/kasse/lieferdaten"
                className="flex items-center justify-center gap-2.5 h-14 bg-rose text-ivory text-[16px] font-semibold tracking-[0.02em] hover:brightness-110 transition-[filter]"
              >
                Weiter zu Ihren Angaben
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
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </Link>
            )}
            <Link
              href="/warenkorb"
              className="self-start inline-flex items-center gap-2 text-[14px] font-semibold text-bark hover:text-rose transition-colors"
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
              Zurück zum Warenkorb
            </Link>
          </div>
        </div>

        <KasseSummary cart={cart} zone={resolvedZone} checkout={checkout} />
      </div>
    </main>
  );
}

function isSlotChosen(c: CheckoutCookie): boolean {
  if (c.ful === "run") return c.rid !== undefined;
  if (c.ful === "timed") return c.rda !== undefined;
  return false;
}

function SlotSection({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <p className="m-0 text-[12px] font-semibold tracking-[0.14em] uppercase text-sage">
        {label}
      </p>
      {children}
      <p className="m-0 text-[12px] leading-[1.5] text-sage">{description}</p>
    </section>
  );
}

function ResolvedZoneBody({
  zone,
  cartSubtotalGross,
}: {
  zone: ResolvedZone;
  cartSubtotalGross: string;
}) {
  const subtotalNum = Number(cartSubtotalGross);
  const minNum = Number(zone.minOrderGross);
  const freeNum = zone.freeOverGross != null ? Number(zone.freeOverGross) : null;
  const belowMin = subtotalNum < minNum;
  const qualifiesFree = freeNum != null && subtotalNum >= freeNum;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="w-[22px] h-[22px] bg-[#2F7A45] text-ivory grid place-items-center text-[12px] font-bold shrink-0"
          >
            ✓
          </span>
          <div>
            <p className="m-0 text-[15px] leading-[1.4] text-bark">
              Wir liefern nach{" "}
              <strong className="font-semibold">
                {zone.plz} {zone.ortschaft}
              </strong>{" "}
              –{" "}
              <span>
                {qualifiesFree
                  ? "die Lieferung ist gratis."
                  : `die Lieferung kostet ${formatChf(zone.feeGross)}.`}
              </span>
            </p>
            <p className="m-0 text-[13px] text-sage mt-0.5">
              Zone {zone.zoneNameDe}
            </p>
          </div>
        </div>
        <ResetCheckoutButton label="PLZ ändern" />
      </div>

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[13px] pt-3 border-t border-hair">
        <dt className="text-sage">Mindestbestellwert</dt>
        <dd className="m-0 text-bark tabular-nums text-right">
          {formatChf(zone.minOrderGross)}
        </dd>
        {zone.freeOverGross && (
          <>
            <dt className="text-sage">Gratis ab</dt>
            <dd className="m-0 text-bark tabular-nums text-right">
              {formatChf(zone.freeOverGross)}
            </dd>
          </>
        )}
      </dl>

      {belowMin && (
        <p className="m-0 px-3 py-2 bg-rose/10 border border-rose/30 text-[13px] text-bark leading-[1.5]">
          Ihre Zwischensumme ({formatChf(cartSubtotalGross)}) liegt unter dem
          Mindestbestellwert dieser Zone ({formatChf(zone.minOrderGross)}).
          Bitte erhöhen Sie den Bestellwert oder wählen Sie eine andere Zone.
        </p>
      )}
    </div>
  );
}

