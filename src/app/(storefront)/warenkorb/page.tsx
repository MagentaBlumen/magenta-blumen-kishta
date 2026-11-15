import Link from "next/link";
import type { Metadata } from "next";
import { CartLineControls } from "@/components/storefront/cart-line-controls";
import { CheckoutProgress } from "@/components/storefront/checkout-progress";
import { hydrateCart } from "@/lib/cart/hydrate";
import { getNextDeliverySlot } from "@/lib/delivery/next-slot";
import { thumbUrl } from "@/lib/image-urls";
import { formatChf } from "@/lib/money";
import type { HydratedCart } from "@/lib/cart/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Warenkorb",
  robots: { index: false, follow: false },
};

// Default global minimum from delivery_zone.min_order_gross.default.
// Per-zone minima (Untersiggenthal 50, Brugg 50-60) get re-checked at
// /kasse/lieferung once the customer picks a PLZ.
const DEFAULT_MIN_ORDER_GROSS = 40;

// Shown as an estimate in the cart. Real fee resolves in /kasse/lieferung
// from delivery_zone once PLZ + Ortschaft are known.
const FREE_SHIPPING_FROM = 120;
const ESTIMATE_DELIVERY_FEE = 12;

export default async function CartPage() {
  const cart = await hydrateCart();
  const itemCount = cart.lines.reduce((n, l) => n + l.qty, 0);

  if (cart.lines.length === 0) {
    return (
      <main className="max-w-[1280px] mx-auto px-4 lg:px-8 py-8 lg:py-10 pb-24 flex flex-col gap-10">
        <CheckoutProgress current="warenkorb" />
        <CartTitle itemCount={0} />
        <EmptyCart />
      </main>
    );
  }

  const subtotalNum = Number(cart.subtotalGross);
  const belowMinimum = subtotalNum < DEFAULT_MIN_ORDER_GROSS;
  const shortfall = Math.max(0, DEFAULT_MIN_ORDER_GROSS - subtotalNum);
  const anySoldOut = cart.lines.some((l) => !l.isAvailable);
  const qualifiesFreeShipping = subtotalNum >= FREE_SHIPPING_FROM;
  const feeNum = qualifiesFreeShipping ? 0 : ESTIMATE_DELIVERY_FEE;
  const totalNum = subtotalNum + feeNum;
  const nextSlot = getNextDeliverySlot();

  return (
    <main className="max-w-[1280px] mx-auto px-4 lg:px-8 py-8 lg:py-10 pb-24 flex flex-col gap-10">
      <CheckoutProgress current="warenkorb" />
      <CartTitle itemCount={itemCount} />

      {cart.droppedCount > 0 && <DroppedBanner count={cart.droppedCount} />}
      {anySoldOut && <SoldOutBanner />}

      <div className="flex flex-col lg:flex-row flex-wrap gap-10 lg:gap-16 items-start">
        <div className="w-full lg:flex-[7_1_520px] min-w-0 flex flex-col">
          <ul className="m-0 p-0 list-none border-t border-hair">
            {cart.lines.map((l) => (
              <CartLineRow key={`${l.productId}:${l.variantId}`} line={l} />
            ))}
          </ul>
          <Link
            href="/kategorie/alle-anlaesse"
            className="self-start mt-6 inline-flex items-center gap-2 text-[14px] font-semibold text-bark hover:text-rose transition-colors"
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
            Weiter einkaufen
          </Link>
        </div>

        <CartSummary
          subtotalNum={subtotalNum}
          feeNum={feeNum}
          totalNum={totalNum}
          qualifiesFreeShipping={qualifiesFreeShipping}
          belowMinimum={belowMinimum}
          shortfall={shortfall}
          anySoldOut={anySoldOut}
          nextSlotLabel={
            nextSlot ? `${nextSlot.dayLabel}, ${nextSlot.timeLabel}` : null
          }
        />
      </div>
    </main>
  );
}

function CartTitle({ itemCount }: { itemCount: number }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-rose">
          Warenkorb
        </p>
        <h1 className="m-0 font-display font-light text-bark text-[clamp(40px,4.4vw,60px)] leading-none tracking-[-0.025em]">
          Ihre <em className="italic text-rose">Auswahl</em>
        </h1>
      </div>
      {itemCount > 0 && (
        <span className="text-[14px] text-sage">
          {itemCount === 1 ? "1 Artikel" : `${itemCount} Artikel`}
        </span>
      )}
    </div>
  );
}

function CartLineRow({ line: l }: { line: HydratedCart["lines"][number] }) {
  return (
    <li className="flex gap-4 lg:gap-6 py-7 border-b border-hair">
      <Link
        href={`/produkt/${l.productSlug}`}
        className="block shrink-0 bg-cream w-[88px] lg:w-[120px]"
      >
        {l.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl(l.imageUrl)}
            alt={l.imageAlt ?? l.productNameDe}
            className="block w-[88px] h-[110px] lg:w-[120px] lg:h-[150px] object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-[88px] h-[110px] lg:w-[120px] lg:h-[150px]" />
        )}
      </Link>

      <div className="flex-1 min-w-0 flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex flex-col gap-1">
            <Link
              href={`/produkt/${l.productSlug}`}
              className="font-display text-[18px] lg:text-[22px] leading-[1.2] text-bark hover:text-rose transition-colors"
            >
              {l.productNameDe}
            </Link>
            {l.variantLabelDe && (
              <span className="text-[13px] text-sage">{l.variantLabelDe}</span>
            )}
            {!l.isAvailable && (
              <span className="text-[13px] text-rose font-semibold">
                Ausverkauft
              </span>
            )}
          </div>
          <span className="font-display text-[18px] lg:text-[22px] whitespace-nowrap text-bark tabular-nums">
            {formatChf(l.lineTotalGross)}
          </span>
        </div>

        <div className="mt-auto">
          <CartLineControls
            productId={l.productId}
            variantId={l.variantId}
            qty={l.qty}
          />
        </div>
      </div>
    </li>
  );
}

function CartSummary({
  subtotalNum,
  feeNum,
  totalNum,
  qualifiesFreeShipping,
  belowMinimum,
  shortfall,
  anySoldOut,
  nextSlotLabel,
}: {
  subtotalNum: number;
  feeNum: number;
  totalNum: number;
  qualifiesFreeShipping: boolean;
  belowMinimum: boolean;
  shortfall: number;
  anySoldOut: boolean;
  nextSlotLabel: string | null;
}) {
  const ctaBlocked = belowMinimum || anySoldOut;
  return (
    <aside
      aria-label="Zusammenfassung"
      className="w-full lg:flex-[4_1_340px] min-w-0 lg:sticky lg:top-6 flex flex-col gap-3.5"
    >
      <div className="mb-wood p-6 lg:p-7 flex flex-col gap-5">
        <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-[#EBDDC9]">
          Zusammenfassung
        </p>

        <dl className="m-0 flex flex-col gap-3 text-[15px]">
          <div className="flex justify-between gap-4">
            <dt className="text-[#EBDDC9]">Zwischensumme</dt>
            <dd className="m-0 tabular-nums">
              {formatChf(subtotalNum.toFixed(2))}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[#EBDDC9]">Lieferung</dt>
            <dd
              className={`m-0 ${
                qualifiesFreeShipping
                  ? "text-[#9BE3A8] font-semibold"
                  : "tabular-nums"
              }`}
            >
              {qualifiesFreeShipping
                ? "Gratis"
                : `ab ${formatChf(feeNum.toFixed(2))}`}
            </dd>
          </div>
        </dl>

        <div className="flex items-baseline justify-between gap-4 pt-[18px] border-t border-white/20">
          <span className="flex flex-col gap-0.5">
            <strong className="text-[15px] font-semibold">Total</strong>
            <span className="text-[12px] text-[#D9C4A8]">inkl. MwSt.</span>
          </span>
          <span className="font-display text-[32px] lg:text-[36px] leading-none whitespace-nowrap tabular-nums">
            {formatChf(totalNum.toFixed(2))}
          </span>
        </div>

        {belowMinimum ? (
          <div className="px-4 py-3 bg-ivory/15 text-ivory text-[13px] leading-[1.5]">
            Mindestbestellwert CHF {DEFAULT_MIN_ORDER_GROSS}.{" "}
            Fehlt noch {formatChf(shortfall.toFixed(2))}.
          </div>
        ) : anySoldOut ? (
          <div className="px-4 py-3 bg-ivory/15 text-ivory text-[13px] leading-[1.5]">
            Ausverkauften Artikel entfernen, um fortzufahren.
          </div>
        ) : null}

        {ctaBlocked ? (
          <span
            aria-disabled="true"
            className="flex items-center justify-center h-14 bg-ivory/20 text-ivory/70 text-[16px] font-semibold tracking-[0.02em] cursor-not-allowed"
          >
            Zur Kasse
          </span>
        ) : (
          <Link
            href="/kasse/lieferung"
            className="flex items-center justify-center gap-2.5 h-14 bg-rose text-ivory text-[16px] font-semibold tracking-[0.02em] hover:brightness-110 transition-[filter]"
          >
            Zur Kasse
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

        {nextSlotLabel && (
          <div className="flex items-center gap-3 text-[13px] text-[#EBDDC9]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M2 7h11v9H2z" />
              <path d="M13 10h4l3 3v3h-7z" />
              <circle cx="6" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
            <span>
              Frühester Liefertermin:{" "}
              <strong className="text-ivory font-semibold">
                {nextSlotLabel}
              </strong>
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 px-0.5 text-[12px] text-sage">
        <span className="flex gap-1.5">
          <span className="h-7 px-2.5 border border-mist inline-flex items-center font-semibold">
            TWINT
          </span>
          <span className="h-7 px-2.5 border border-mist inline-flex items-center font-semibold">
            Karte
          </span>
        </span>
        <span>In einzelnen Zonen gilt ein höherer Mindestbestellwert.</span>
      </div>
    </aside>
  );
}

function EmptyCart() {
  return (
    <div className="border border-hair px-6 py-14 flex flex-col items-center gap-4 text-center">
      <p className="m-0 font-display text-[26px] text-bark">
        Ihr Warenkorb ist leer
      </p>
      <p className="m-0 text-[15px] text-sage max-w-md">
        Entdecken Sie die Sträusse dieser Woche — oder rufen Sie uns an unter{" "}
        <a href="tel:+41565565609" className="text-rose hover:underline">
          056 556 56 09
        </a>
        .
      </p>
      <Link
        href="/kategorie/alle-anlaesse"
        className="mt-2 inline-flex items-center h-12 px-6 bg-rose text-ivory text-[15px] font-semibold hover:brightness-110 transition-[filter]"
      >
        Blumen entdecken
      </Link>
    </div>
  );
}

function DroppedBanner({ count }: { count: number }) {
  return (
    <div className="px-4 py-3 bg-cream border border-hair text-[13px] text-bark">
      {count === 1
        ? "1 Artikel wurde aus dem Warenkorb entfernt, weil er nicht mehr verfügbar ist."
        : `${count} Artikel wurden aus dem Warenkorb entfernt, weil sie nicht mehr verfügbar sind.`}
    </div>
  );
}

function SoldOutBanner() {
  return (
    <div className="px-4 py-3 border border-rose/40 bg-rose/5 text-[13px] text-bark">
      Ein Artikel in Ihrem Warenkorb ist zurzeit ausverkauft und muss entfernt
      werden, bevor Sie zur Kasse gehen können.
    </div>
  );
}
