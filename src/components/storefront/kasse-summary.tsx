import Link from "next/link";
import { formatChf } from "@/lib/money";
import { thumbUrl } from "@/lib/image-urls";
import type { CheckoutCookie, ResolvedZone } from "@/lib/checkout/types";
import type { HydratedCart } from "@/lib/cart/types";

// Dark wood-walnut summary slab reused across /warenkorb, /kasse/lieferung,
// /kasse/lieferdaten, /kasse/bestaetigen. Shows line items, the lieferung
// state as filled in so far, and a running Zwischensumme/Lieferung/Total.
//
// `editHref` is the "Bearbeiten" target — usually /warenkorb, but the
// final confirm page points back to its own cart edit.
export function KasseSummary({
  cart,
  zone,
  checkout,
  editHref = "/warenkorb",
}: {
  cart: HydratedCart;
  zone: ResolvedZone | null;
  checkout: CheckoutCookie;
  editHref?: string;
}) {
  const subtotalNum = Number(cart.subtotalGross);
  const freeNum =
    zone?.freeOverGross != null ? Number(zone.freeOverGross) : null;
  const qualifiesFree =
    zone != null && freeNum != null && subtotalNum >= freeNum;
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
            href={editHref}
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

// Human-readable "when" line from the checkout cookie. The cookie only
// carries IDs/ISO strings; the real "Montag, 16. November · 10-12 Uhr"
// label is computed on /kasse/bestaetigen where we re-join delivery_run.
function slotWhenText(c: CheckoutCookie): string | null {
  if (c.ful === "run" && c.rid) return "Zeitfenster gewählt";
  if (c.ful === "timed" && c.rda) return c.rda.slice(0, 10);
  return null;
}
