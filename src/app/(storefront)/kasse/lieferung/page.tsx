import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckoutProgress } from "@/components/storefront/checkout-progress";
import { FulfilmentPicker } from "@/components/storefront/fulfilment-picker";
import { PlzForm } from "@/components/storefront/plz-form";
import { ResetCheckoutButton } from "@/components/storefront/reset-checkout-button";
import { RunSlotPicker } from "@/components/storefront/run-slot-picker";
import { TimedSlotPicker } from "@/components/storefront/timed-slot-picker";
import { readCheckoutCookie } from "@/lib/checkout/cookie";
import {
  getAvailableRunSlots,
  getAvailableTimedSlots,
  type RunSlotDay,
  type TimedSlotDay,
} from "@/lib/checkout/slots";
import { lookupPlz, resolveZoneByPlzOrtschaft } from "@/lib/checkout/zones";
import { hydrateCart } from "@/lib/cart/hydrate";
import { thumbUrl } from "@/lib/image-urls";
import { formatChf } from "@/lib/money";
import type { CheckoutCookie, ResolvedZone } from "@/lib/checkout/types";
import type { HydratedCart } from "@/lib/cart/types";

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
          <Box
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
          </Box>

          {mode === "zone-resolved" && resolvedZone && (
            <Box
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
            </Box>
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

function Box({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-[#E1D5C7] bg-ivory p-6 lg:p-7 flex flex-col gap-5">
      <div className="flex gap-3.5 items-start">
        <span
          aria-hidden
          className="w-7 h-7 mt-0.5 bg-bark text-ivory grid place-items-center font-display text-[15px] shrink-0"
        >
          {number}
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="m-0 font-display font-normal text-[22px] lg:text-[24px] leading-[1.2] text-bark">
            {title}
          </h2>
          {hint && (
            <p className="m-0 text-[14px] leading-[1.5] text-sage">{hint}</p>
          )}
        </div>
      </div>
      <div className="pt-5 border-t border-[#E6DDD2] flex flex-col gap-4">
        {children}
      </div>
    </section>
  );
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

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-[13px] pt-3 border-t border-[#E6DDD2]">
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

function KasseSummary({
  cart,
  zone,
  checkout,
}: {
  cart: HydratedCart;
  zone: ResolvedZone | null;
  checkout: CheckoutCookie;
}) {
  const subtotalNum = Number(cart.subtotalGross);
  const freeNum = zone?.freeOverGross != null ? Number(zone.freeOverGross) : null;
  const qualifiesFree = zone != null && freeNum != null && subtotalNum >= freeNum;
  const feeNum = zone == null ? null : qualifiesFree ? 0 : Number(zone.feeGross);
  const totalNum = zone == null ? subtotalNum : subtotalNum + (feeNum ?? 0);

  const whenText = slotWhenText(checkout);
  const placeText = zone ? `${zone.plz} ${zone.ortschaft}` : null;

  return (
    <aside
      aria-label="Ihre Bestellung"
      className="w-full lg:flex-[4_1_320px] min-w-0 lg:sticky lg:top-6"
    >
      <div className="mb-wood p-6 lg:p-7 flex flex-col gap-4">
        <div className="flex justify-between items-baseline gap-3">
          <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-[#EBDDC9]">
            Ihre Bestellung
          </p>
          <Link
            href="/warenkorb"
            className="text-[12px] underline text-[#EBDDC9] hover:text-ivory transition-colors"
          >
            Bearbeiten
          </Link>
        </div>

        <ul className="m-0 p-0 list-none flex flex-col gap-3">
          {cart.lines.map((l) => (
            <li
              key={`${l.productId}:${l.variantId}`}
              className="flex items-center gap-3"
            >
              {l.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl(l.imageUrl)}
                  alt=""
                  className="w-11 h-[54px] object-cover shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-11 h-[54px] bg-ivory/15 shrink-0" />
              )}
              <span className="flex-1 min-w-0 flex flex-col gap-0.5 text-[14px]">
                <span className="truncate">{l.productNameDe}</span>
                <span className="text-[12px] text-[#D9C4A8]">
                  {l.qty} × {l.variantLabelDe ?? "Standard"}
                </span>
              </span>
              <span className="text-[14px] tabular-nums whitespace-nowrap">
                {formatChf(l.lineTotalGross)}
              </span>
            </li>
          ))}
        </ul>

        <div className="pt-4 border-t border-white/20 flex flex-col gap-1.5">
          <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-[#EBDDC9] inline-flex items-center gap-2">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2 7h11v9H2z" />
              <path d="M13 10h4l3 3v3h-7z" />
              <circle cx="6" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
            Lieferung
          </p>
          <span className="text-[14px] text-ivory">
            {whenText ?? "Tag noch offen"}
          </span>
          <span className="text-[14px] text-[#EBDDC9]">
            {placeText ?? "Postleitzahl noch offen"}
          </span>
        </div>

        <dl className="m-0 pt-4 border-t border-white/20 flex flex-col gap-2.5 text-[14px]">
          <div className="flex justify-between gap-3">
            <dt className="text-[#EBDDC9]">Zwischensumme</dt>
            <dd className="m-0 tabular-nums">
              {formatChf(cart.subtotalGross)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[#EBDDC9]">Lieferung</dt>
            <dd
              className={`m-0 ${
                qualifiesFree ? "text-[#9BE3A8] font-semibold" : "tabular-nums"
              }`}
            >
              {zone == null
                ? "nach PLZ"
                : qualifiesFree
                  ? "Gratis"
                  : formatChf((feeNum ?? 0).toFixed(2))}
            </dd>
          </div>
        </dl>

        <div className="flex justify-between items-baseline gap-3 pt-4 border-t border-white/20">
          <span className="flex flex-col gap-0.5">
            <strong className="text-[15px] font-semibold">Total</strong>
            <span className="text-[12px] text-[#D9C4A8]">inkl. MwSt.</span>
          </span>
          <span className="font-display text-[32px] leading-none whitespace-nowrap tabular-nums">
            {formatChf(totalNum.toFixed(2))}
          </span>
        </div>
      </div>
    </aside>
  );
}

// Builds the human-readable "when" line from the checkout cookie for
// the summary slab. Returns null when nothing is chosen yet.
function slotWhenText(c: CheckoutCookie): string | null {
  if (c.ful === "run" && c.rid) {
    // We don't have the run_date on the cookie; a full render would
    // join on delivery_run. For now the resolved summary just signals
    // "Zeitfenster gewählt" and the full "Montag, 16. November ·
    // 10–12 Uhr" line lands on the bestaetigen page.
    return "Zeitfenster gewählt";
  }
  if (c.ful === "timed" && c.rda) {
    // ISO string — crude label without pulling Luxon into a server
    // helper. Final formatting happens on bestaetigen.
    return c.rda.slice(0, 10);
  }
  return null;
}

// Keep the helper exports around for the slot section typing
export type { RunSlotDay, TimedSlotDay };
