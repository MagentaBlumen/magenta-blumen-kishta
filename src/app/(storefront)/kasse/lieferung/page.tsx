import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FulfilmentPicker } from "@/components/storefront/fulfilment-picker";
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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasse . Lieferung",
  robots: { index: false, follow: false },
};

/**
 * Checkout step 1: PLZ resolution.
 *
 * Empty cart -> back to /warenkorb (nothing to check out).
 * No PLZ yet -> PLZ input.
 * PLZ set but ambiguous (5415) and no Ortschaft -> re-render the picker
 *   from a fresh lookup, so a reload doesn't lose the customer's spot.
 * Zone resolved -> show the resolved-zone card + slot-picker placeholder
 *   (5d-part-2 lands the slot picker once Luxon is approved).
 */
export default async function KasseLieferungPage() {
  const cart = await hydrateCart();
  if (cart.lines.length === 0) {
    redirect("/warenkorb");
  }

  const checkout = await readCheckoutCookie();

  // Resolve current state into one of three view modes.
  let mode: "enter-plz" | "pick-ortschaft" | "zone-resolved";
  let pickerOptions: Awaited<ReturnType<typeof lookupPlz>> | null = null;
  let resolvedZone: Awaited<
    ReturnType<typeof resolveZoneByPlzOrtschaft>
  > | null = null;

  if (checkout.plz && checkout.ort && checkout.zid) {
    // Re-fetch the zone so a stale zid (zone renamed / fee changed)
    // shows current data. Cheap query, cached upstream in practice.
    resolvedZone = await resolveZoneByPlzOrtschaft(checkout.plz, checkout.ort);
    if (!resolvedZone) {
      // Cookie references something that no longer exists - start over.
      mode = "enter-plz";
    } else {
      mode = "zone-resolved";
    }
  } else if (checkout.plz) {
    // PLZ typed but Ortschaft not chosen yet - re-render the picker.
    pickerOptions = await lookupPlz(checkout.plz);
    if (pickerOptions.kind !== "picker") {
      // Shouldn't happen (submit action would have committed a single),
      // but degrade gracefully.
      mode = "enter-plz";
    } else {
      mode = "pick-ortschaft";
    }
  } else {
    mode = "enter-plz";
  }

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-10 lg:py-14">
      <CheckoutStepHeader step={1} />

      <div className="mt-10 space-y-8">
        {mode === "enter-plz" && <EnterPlzBlock />}

        {mode === "pick-ortschaft" &&
          pickerOptions?.kind === "picker" && (
            <PickOrtschaftBlock
              plz={checkout.plz!}
              options={pickerOptions.options}
            />
          )}

        {mode === "zone-resolved" && resolvedZone && (
          <>
            <ResolvedZoneCard
              plz={resolvedZone.plz}
              ortschaft={resolvedZone.ortschaft}
              zoneNameDe={resolvedZone.zoneNameDe}
              feeGross={resolvedZone.feeGross}
              minOrderGross={resolvedZone.minOrderGross}
              freeOverGross={resolvedZone.freeOverGross}
              cartSubtotalGross={cart.subtotalGross}
            />

            <FulfilmentPicker value={checkout.ful === "pickup" ? undefined : checkout.ful} />

            {checkout.ful === "run" && <RunSlotSection selectedRunId={checkout.rid} />}
            {checkout.ful === "timed" && (
              <TimedSlotSection selectedIso={checkout.rda} />
            )}

            {/* Continue button appears once a slot is chosen. /kasse/lieferdaten
                lands in 5e (buyer + recipient form). */}
            {isSlotChosen(checkout) && (
              <div className="pt-2">
                <Link
                  href="/kasse/lieferdaten"
                  className="block text-center h-[52px] leading-[52px] bg-rose text-ivory text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-[#831249] transition-colors"
                >
                  Weiter zu Ihren Daten
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-10 flex items-center justify-between text-[0.72rem] tracking-[0.08em] uppercase">
        <Link href="/warenkorb" className="text-sage hover:text-rose transition-colors">
          ← Zurück zum Warenkorb
        </Link>
      </div>
    </div>
  );
}

function isSlotChosen(c: Awaited<ReturnType<typeof readCheckoutCookie>>): boolean {
  if (c.ful === "run") return c.rid !== undefined;
  if (c.ful === "timed") return c.rda !== undefined;
  return false;
}

async function RunSlotSection({ selectedRunId }: { selectedRunId: number | undefined }) {
  const days = await getAvailableRunSlots();
  return (
    <section className="space-y-3">
      <p className="text-[0.68rem] tracking-[0.16em] uppercase text-bark font-medium">
        Verfügbare Termine
      </p>
      <RunSlotPicker days={days} selectedRunId={selectedRunId} />
    </section>
  );
}

async function TimedSlotSection({ selectedIso }: { selectedIso: string | undefined }) {
  const days = await getAvailableTimedSlots();
  return (
    <section className="space-y-3">
      <p className="text-[0.68rem] tracking-[0.16em] uppercase text-bark font-medium">
        Zeitpunkt wählen
      </p>
      <TimedSlotPicker days={days} selectedIso={selectedIso} />
    </section>
  );
}

// ------------------------------------------------------------------

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
        Wohin dürfen wir liefern?
      </h1>
      <ol className="mt-6 flex gap-4 text-[0.72rem] tracking-[0.1em] uppercase font-medium">
        {steps.map((s) => (
          <li
            key={s.n}
            className={`flex items-center gap-2 ${s.n === step ? "text-bark" : "text-sage"}`}
          >
            <span
              className={`inline-flex items-center justify-center w-6 h-6 border ${s.n === step ? "border-bark bg-bark text-ivory" : "border-mist text-sage"}`}
            >
              {s.n}
            </span>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
    </>
  );
}

function EnterPlzBlock() {
  return (
    <section className="space-y-5">
      <p className="text-[0.9rem] text-bark leading-[1.7]">
        Wir liefern in 27 Postleitzahlen im Aargau (und einigen angrenzenden
        Zürcher Gemeinden) mit unserem eigenen Van. Bitte prüfen Sie zuerst,
        ob Ihre PLZ dabei ist.
      </p>
      <PlzForm />
    </section>
  );
}

function PickOrtschaftBlock({
  plz,
  options,
}: {
  plz: string;
  options: {
    ortschaft: string;
    zoneNameDe: string;
    feeGross: string;
    minOrderGross: string;
  }[];
}) {
  return (
    <section className="space-y-5">
      <p className="text-[0.9rem] text-bark leading-[1.7]">
        Für die PLZ <span className="tabular-nums font-medium">{plz}</span> gibt
        es mehrere Ortschaften mit unterschiedlichen Preisen. Bitte wählen Sie
        die richtige aus.
      </p>
      {/* The PlzForm client component handles the picker interaction
          when it's mounted right after a submit. On a reload we render
          the picker as a fresh PlzForm with initialPlz so the customer
          doesn't lose their spot. */}
      <PlzForm initialPlz={plz} />
      {/* Hint list for reloads - the client picker only appears after
          submit; showing options inline as read-only lets someone with
          a stale page still see what they're picking between. */}
      <details className="text-[0.8rem] text-sage">
        <summary className="cursor-pointer hover:text-bark">
          Verfügbare Ortschaften anzeigen
        </summary>
        <ul className="mt-2 space-y-1 pl-4 list-disc">
          {options.map((o) => (
            <li key={o.ortschaft}>
              {o.ortschaft} . {formatChf(o.feeGross)} . Mindestbestellwert{" "}
              {formatChf(o.minOrderGross)}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function ResolvedZoneCard({
  plz,
  ortschaft,
  zoneNameDe,
  feeGross,
  minOrderGross,
  freeOverGross,
  cartSubtotalGross,
}: {
  plz: string;
  ortschaft: string;
  zoneNameDe: string;
  feeGross: string;
  minOrderGross: string;
  freeOverGross: string | null;
  cartSubtotalGross: string;
}) {
  const subtotalNum = Number(cartSubtotalGross);
  const minNum = Number(minOrderGross);
  const freeNum = freeOverGross != null ? Number(freeOverGross) : null;
  const belowMin = subtotalNum < minNum;
  const qualifiesFreeDelivery = freeNum != null && subtotalNum >= freeNum;

  return (
    <section className="border border-mist bg-cream p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] tracking-[0.16em] uppercase text-sage font-medium mb-1">
            Ihre Lieferadresse
          </p>
          <p className="font-display text-[1.3rem] text-bark leading-tight">
            {plz} {ortschaft}
          </p>
          <p className="text-[0.78rem] text-sage mt-1">Zone {zoneNameDe}</p>
        </div>
        <ResetCheckoutButton label="PLZ ändern" />
      </div>

      <dl className="grid gap-2 text-[0.85rem] pt-3 border-t border-mist">
        <div className="flex justify-between">
          <dt className="text-sage">Lieferung</dt>
          <dd className="text-bark tabular-nums font-medium">
            {qualifiesFreeDelivery ? "gratis" : formatChf(feeGross)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-sage">Mindestbestellwert</dt>
          <dd className="text-bark tabular-nums">{formatChf(minOrderGross)}</dd>
        </div>
        {freeOverGross && (
          <div className="flex justify-between text-[0.78rem]">
            <dt className="text-sage">Gratis-Lieferung ab</dt>
            <dd className="text-sage tabular-nums">
              {formatChf(freeOverGross)}
            </dd>
          </div>
        )}
      </dl>

      {belowMin && (
        <p className="px-3 py-2 bg-rose/10 border border-rose/30 text-[0.8rem] text-bark leading-[1.55]">
          Ihre Zwischensumme ({formatChf(cartSubtotalGross)}) liegt unter dem
          Mindestbestellwert dieser Zone ({formatChf(minOrderGross)}). Bitte
          erhöhen Sie den Bestellwert oder wählen Sie eine andere Zone.
        </p>
      )}
    </section>
  );
}
