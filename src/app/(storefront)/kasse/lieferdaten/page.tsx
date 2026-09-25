import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LieferdatenForm } from "@/components/storefront/lieferdaten-form";
import { hydrateCart } from "@/lib/cart/hydrate";
import { readCheckoutCookie } from "@/lib/checkout/cookie";
import { resolveZoneByPlzOrtschaft } from "@/lib/checkout/zones";
import { formatChf } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasse . Ihre Daten",
  robots: { index: false, follow: false },
};

/**
 * Checkout step 2: buyer + recipient + delivery-context form.
 *
 * Gates:
 *   - Empty cart -> /warenkorb
 *   - No zone or no slot picked yet -> /kasse/lieferung
 *
 * Form submission goes to submitDetailsAction which redirects to
 * /kasse/bestaetigen on success.
 */
export default async function KasseLieferdatenPage() {
  const cart = await hydrateCart();
  if (cart.lines.length === 0) redirect("/warenkorb");

  const checkout = await readCheckoutCookie();

  // Step 1 must be complete before step 2.
  const step1Done =
    checkout.plz &&
    checkout.ort &&
    checkout.zid &&
    checkout.ful &&
    (checkout.rid !== undefined || checkout.rda !== undefined);
  if (!step1Done) redirect("/kasse/lieferung");

  // Show a summary line of what step 1 resolved to.
  const zone = await resolveZoneByPlzOrtschaft(checkout.plz!, checkout.ort!);

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-10 lg:py-14">
      <CheckoutStepHeader step={2} />

      {zone && (
        <div className="mt-8 flex items-start justify-between gap-4 border border-mist bg-cream px-4 py-3">
          <div className="text-[0.85rem] text-bark leading-[1.55]">
            Lieferung an{" "}
            <span className="font-medium">
              {zone.plz} {zone.ortschaft}
            </span>{" "}
            . Gebühr {formatChf(zone.feeGross)}
          </div>
          <Link
            href="/kasse/lieferung"
            className="inline-block px-3 py-1 border border-rose text-rose text-[0.65rem] tracking-[0.1em] uppercase font-medium hover:bg-rose hover:text-ivory transition-colors flex-shrink-0"
          >
            Ändern
          </Link>
        </div>
      )}

      <div className="mt-8">
        <LieferdatenForm defaults={checkout} />
      </div>

      <div className="mt-10">
        <Link
          href="/kasse/lieferung"
          className="inline-block px-4 py-2 border border-rose text-rose text-[0.7rem] tracking-[0.14em] uppercase font-medium hover:bg-rose hover:text-ivory transition-colors"
        >
          ← Zurück zur Lieferung
        </Link>
      </div>
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
        Ihre Angaben
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
