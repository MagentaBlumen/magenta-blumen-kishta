import Link from "next/link";
import type { Metadata } from "next";
import { CartLineControls } from "@/components/storefront/cart-line-controls";
import { hydrateCart } from "@/lib/cart/hydrate";
import { thumbUrl } from "@/lib/image-urls";
import { formatChf } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Warenkorb",
  robots: { index: false, follow: false },
};

// The DEFAULT global minimum from delivery_zone.min_order_gross.default.
// Individual zones can be higher (Untersiggenthal 50, Brugg 50-60); the
// per-zone check happens in checkout 5d once the customer picks a PLZ.
// Shown here so the CHF 40 rejection surfaces in the cart rather than
// two screens later (per the plan).
const DEFAULT_MIN_ORDER_GROSS = 40;

export default async function CartPage() {
  const cart = await hydrateCart();

  if (cart.lines.length === 0) {
    return <EmptyCart />;
  }

  const subtotalNum = Number(cart.subtotalGross);
  const belowMinimum = subtotalNum < DEFAULT_MIN_ORDER_GROSS;
  const shortfall = Math.max(0, DEFAULT_MIN_ORDER_GROSS - subtotalNum);
  const anySoldOut = cart.lines.some((l) => !l.isAvailable);

  return (
    <div className="max-w-6xl mx-auto px-4 lg:px-6 py-10 lg:py-14">
      <header className="mb-8">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium mb-2">
          Warenkorb
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
          Ihre Auswahl
        </h1>
      </header>

      {cart.droppedCount > 0 && (
        <div className="mb-6 px-4 py-3 bg-cream border border-mist text-[0.8rem] text-bark">
          {cart.droppedCount === 1
            ? "1 Artikel wurde aus dem Warenkorb entfernt, weil er nicht mehr verfügbar ist."
            : `${cart.droppedCount} Artikel wurden aus dem Warenkorb entfernt, weil sie nicht mehr verfügbar sind.`}
        </div>
      )}

      {anySoldOut && (
        <div className="mb-6 px-4 py-3 border border-rose/40 bg-rose/5 text-[0.8rem] text-bark">
          Ein Artikel in Ihrem Warenkorb ist zurzeit ausverkauft und muss
          entfernt werden, bevor Sie zur Kasse gehen können.
        </div>
      )}

      <div className="grid gap-10 lg:grid-cols-[1fr_360px] items-start">
        {/* -------- Lines -------- */}
        <ul className="border-t border-mist">
          {cart.lines.map((l) => (
            <li
              key={`${l.productId}:${l.variantId}`}
              className="grid grid-cols-[80px_1fr_auto] sm:grid-cols-[100px_1fr_auto] gap-4 sm:gap-6 py-5 border-b border-mist"
            >
              <Link
                href={`/produkt/${l.productSlug}`}
                className="block aspect-[3/4] bg-mist overflow-hidden"
              >
                {l.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrl(l.imageUrl)}
                    alt={l.imageAlt ?? l.productNameDe}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </Link>

              <div className="min-w-0 flex flex-col gap-1.5">
                <Link
                  href={`/produkt/${l.productSlug}`}
                  className="font-display text-[1.1rem] text-bark leading-tight hover:text-rose transition-colors"
                >
                  {l.productNameDe}
                </Link>
                {l.variantLabelDe && (
                  <p className="text-[0.72rem] tracking-[0.06em] uppercase text-sage">
                    {l.variantLabelDe}
                  </p>
                )}
                {!l.isAvailable && (
                  <p className="text-[0.7rem] tracking-[0.08em] uppercase text-rose font-medium">
                    Ausverkauft
                  </p>
                )}
                <p className="text-[0.78rem] text-sage tabular-nums">
                  {formatChf(l.unitPriceGross)} / Stück
                </p>
                <div className="pt-2">
                  <CartLineControls
                    productId={l.productId}
                    variantId={l.variantId}
                    qty={l.qty}
                  />
                </div>
              </div>

              <div className="text-right">
                <p className="font-display text-[1.1rem] text-bark tabular-nums">
                  {formatChf(l.lineTotalGross)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* -------- Summary -------- */}
        <aside className="bg-cream border border-mist p-6 lg:sticky lg:top-24">
          <h2 className="text-[0.68rem] tracking-[0.2em] uppercase font-medium text-bark mb-4">
            Zusammenfassung
          </h2>

          <dl className="space-y-2 text-[0.9rem]">
            <div className="flex justify-between">
              <dt className="text-bark">Zwischensumme</dt>
              <dd className="text-bark tabular-nums font-medium">
                {formatChf(cart.subtotalGross)}
              </dd>
            </div>
            <div className="flex justify-between text-[0.78rem] text-sage">
              <dt>Lieferung</dt>
              <dd>wird bei der Kasse berechnet</dd>
            </div>
          </dl>

          <div className="mt-6 pt-5 border-t border-mist">
            <div className="flex items-baseline justify-between">
              <span className="text-[0.72rem] tracking-[0.12em] uppercase font-medium text-bark">
                Total (ohne Lieferung)
              </span>
              <span className="font-display text-[1.4rem] text-bark tabular-nums">
                {formatChf(cart.subtotalGross)}
              </span>
            </div>
          </div>

          {/* -------- Minimum-order gate --------
              Per the checkout spec: reject at the cart, not two screens
              later. The default zone minimum is CHF 40 (ohne Karte + Transport,
              per her price sheet). Individual zones may be higher and get
              enforced again at PLZ resolution in 5d. */}
          {belowMinimum && (
            <div className="mt-4 px-3 py-2 bg-rose/10 border border-rose/30 text-[0.78rem] text-bark leading-[1.55]">
              Mindestbestellwert CHF {DEFAULT_MIN_ORDER_GROSS.toFixed(2)}.
              Bitte fügen Sie noch <span className="font-medium">CHF {shortfall.toFixed(2)}</span>{" "}
              hinzu, um zur Kasse zu gehen.
            </div>
          )}

          <CheckoutButton disabled={belowMinimum || anySoldOut} />

          <p className="mt-4 text-[0.7rem] text-sage leading-[1.55]">
            Alle Preise inkl. MwSt. Höhere Mindestbestellwerte gelten in
            einzelnen Zonen.
          </p>
        </aside>
      </div>

      <div className="mt-10">
        <Link
          href="/kategorie/alle-anlaesse"
          className="text-[0.72rem] tracking-[0.12em] uppercase text-sage hover:text-rose transition-colors"
        >
          ← Weiter einkaufen
        </Link>
      </div>
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center space-y-6">
      <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
        Warenkorb
      </p>
      <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
        Ihr Warenkorb ist leer.
      </h1>
      <p className="text-[0.9rem] text-bark/70 leading-[1.7] font-light">
        Stöbern Sie im Sortiment oder rufen Sie uns direkt an.
      </p>
      <div className="pt-4 flex flex-wrap gap-3 justify-center">
        <Link
          href="/kategorie/alle-anlaesse"
          className="inline-block bg-bark text-ivory px-9 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose transition-colors"
        >
          Zum Sortiment
        </Link>
        <a
          href="tel:+41565565609"
          className="inline-block border border-bark text-bark px-9 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-bark hover:text-ivory transition-colors"
        >
          Anrufen
        </a>
      </div>
    </div>
  );
}

function CheckoutButton({ disabled }: { disabled: boolean }) {
  const base =
    "block w-full text-center mt-5 h-[52px] leading-[52px] text-[0.72rem] tracking-[0.16em] uppercase font-medium transition-colors";
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className={`${base} bg-mist text-sage cursor-not-allowed`}
      >
        Zur Kasse
      </span>
    );
  }
  return (
    <Link
      href="/kasse/lieferung"
      className={`${base} bg-rose text-ivory hover:bg-[#831249]`}
    >
      Zur Kasse
    </Link>
  );
}
