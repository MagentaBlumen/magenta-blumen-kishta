import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { fetchGuestOrderView } from "@/lib/order-lookup/fetch";
import { verifyOrderViewToken } from "@/lib/order-lookup/token";
import { formatChf } from "@/lib/money";
import type { OrderStatus } from "@/lib/admin/order-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ihre Bestellung",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ number: string }>;
};

/**
 * The payoff page after a successful order-number + email match. The
 * cookie bound to this order number MUST be present and unexpired -
 * otherwise bounce back to the form. We re-fetch from the DB on every
 * load so a buyer who comes back later sees fresh status.
 *
 * No admin fields are shown (internal notes, buyer phone, recipient
 * phone, Stripe intent, refund log). The buyer sees what they need to
 * answer "did my order go through, is it on its way".
 */
export default async function GuestOrderViewPage({ params }: PageProps) {
  const { number } = await params;
  const orderNumber = decodeURIComponent(number);

  const ok = await verifyOrderViewToken(orderNumber);
  if (!ok) redirect("/bestellung-finden");

  const data = await fetchGuestOrderView(orderNumber);
  if (!data) redirect("/bestellung-finden?error=NotFound");

  const slotLabel = buildSlotLabel(data);

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 py-12 lg:py-16 space-y-10">
      <header className="space-y-2">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
          Ihre Bestellung
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.1] tabular-nums">
          {data.orderNumber}
        </h1>
        <p className="text-[0.85rem] text-bark/70">
          Bestellt am{" "}
          {DateTime.fromJSDate(data.placedAt, { zone: "Europe/Zurich" })
            .setLocale("de-CH")
            .toFormat("ccc d. LLLL yyyy, HH:mm")}{" "}
          Uhr
        </p>
      </header>

      <section className="border border-mist p-5 space-y-3">
        <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
          Status
        </h2>
        <StatusLine status={data.status} />
        <p className="text-[0.82rem] text-bark/70 leading-[1.65]">
          {statusHintDe(data.status)}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
          Lieferung
        </h2>
        <dl className="text-[0.9rem] text-bark/85 space-y-1.5 leading-[1.6]">
          <Row label="Termin" value={slotLabel} />
          <Row label="Empfänger" value={data.recipientName} />
          <Row
            label="Adresse"
            value={[data.deliveryStreet, data.deliveryPlz, data.deliveryCity]
              .filter(Boolean)
              .join(", ") || "Abholung im Laden"}
          />
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
          Artikel
        </h2>
        <ul className="divide-y divide-mist border-y border-mist">
          {data.lines.map((l) => (
            <li
              key={l.id}
              className="grid grid-cols-[1fr_auto] gap-3 py-3 text-[0.9rem]"
            >
              <div>
                <div className="text-bark">{l.productNameDe}</div>
                {l.variantLabelDe && (
                  <div className="text-[0.78rem] text-sage">
                    {l.variantLabelDe}
                  </div>
                )}
                <div className="text-[0.78rem] text-sage mt-0.5 tabular-nums">
                  {l.quantity} × {formatChf(l.unitPriceGross)}
                </div>
              </div>
              <div className="text-right tabular-nums text-bark font-medium">
                {formatChf(l.lineTotalGross)}
              </div>
            </li>
          ))}
        </ul>
        <dl className="text-[0.9rem] space-y-1 pt-1">
          <SumRow label="Zwischensumme" value={formatChf(data.subtotalGross)} />
          <SumRow
            label="Lieferung"
            value={
              Number(data.deliveryFeeGross) === 0
                ? "gratis"
                : formatChf(data.deliveryFeeGross)
            }
          />
          {Number(data.giftcardAppliedGross) > 0 && (
            <SumRow
              label="Gutschein"
              value={`− ${formatChf(data.giftcardAppliedGross)}`}
            />
          )}
          <SumRow label="Total" value={formatChf(data.totalGross)} strong />
        </dl>
      </section>

      {(data.cardMessage || data.ribbonText) && (
        <section className="space-y-3">
          <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
            Karte · Band
          </h2>
          {data.cardMessage && (
            <blockquote className="border-l-4 border-rose bg-ivory px-4 py-3 text-[0.9rem] italic text-bark/85 leading-[1.6]">
              «{data.cardMessage}»
              {data.cardIsAnonymous && (
                <span className="not-italic text-[0.78rem] text-sage ml-2">
                  (anonym)
                </span>
              )}
            </blockquote>
          )}
          {data.ribbonText && (
            <p className="text-[0.9rem] text-bark/85">
              <span className="font-medium">Trauerband:</span> «{data.ribbonText}»
            </p>
          )}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
          Zahlung
        </h2>
        <p className="text-[0.9rem] text-bark/85">
          {paymentSummaryDe(data.paymentSummary.isPaid, data.paymentSummary.method)}
        </p>
      </section>

      <div className="pt-6 border-t border-mist flex flex-wrap gap-3 justify-between items-center">
        <Link
          href="/"
          className="text-[0.82rem] text-sage hover:text-rose transition-colors"
        >
          ← Zurück zur Startseite
        </Link>
        <a
          href="tel:+41565565609"
          className="inline-block border border-bark text-bark px-6 py-2.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-bark hover:text-ivory transition-colors"
        >
          Fragen? 056 556 56 09
        </a>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Pure helpers (no DB, no cookies - safe to colocate in the page).
// ------------------------------------------------------------------

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-sage">{label}</dt>
      <dd className="text-bark/85">{value}</dd>
    </div>
  );
}

function SumRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${
        strong ? "font-semibold pt-1.5 border-t border-mist text-bark" : "text-bark/80"
      }`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function StatusLine({ status }: { status: OrderStatus }) {
  const tone =
    status === "delivered"
      ? "bg-emerald-50 border-emerald-300 text-emerald-800"
      : status === "out_for_delivery"
        ? "bg-sky-50 border-sky-300 text-sky-800"
        : status === "ready"
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : status === "in_production"
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : status === "delivery_failed"
              ? "bg-rose-50 border-rose-300 text-rose-800"
              : status === "cancelled"
                ? "bg-stone-50 border-stone-200 text-stone-600 line-through"
                : "bg-stone-50 border-stone-200 text-stone-700";
  return (
    <div
      className={`inline-flex items-center px-3 py-1.5 text-[0.9rem] font-medium border rounded ${tone}`}
    >
      {statusLabelDe(status)}
    </div>
  );
}

function statusLabelDe(s: OrderStatus): string {
  switch (s) {
    case "new":
      return "Eingegangen";
    case "confirmed":
      return "Bestätigt";
    case "in_production":
      return "Wird gebunden";
    case "ready":
      return "Fertig für Lieferung";
    case "out_for_delivery":
      return "Unterwegs";
    case "delivered":
      return "Zugestellt";
    case "delivery_failed":
      return "Lieferung fehlgeschlagen";
    case "cancelled":
      return "Storniert";
  }
}

function statusHintDe(s: OrderStatus): string {
  switch (s) {
    case "new":
      return "Wir haben Ihre Bestellung erhalten und bereiten alles vor.";
    case "confirmed":
      return "Ihre Bestellung ist bestätigt und für die Produktion eingeplant.";
    case "in_production":
      return "Der Strauss wird gerade in der Werkstatt gebunden.";
    case "ready":
      return "Fertig und bereit zur Lieferung bzw. Abholung.";
    case "out_for_delivery":
      return "Der Fahrer ist unterwegs zum Empfänger.";
    case "delivered":
      return "Zugestellt. Danke für Ihr Vertrauen.";
    case "delivery_failed":
      return "Wir konnten nicht zustellen und melden uns bei Ihnen. Rufen Sie uns gern an, wenn Sie uns zuvorkommen möchten.";
    case "cancelled":
      return "Diese Bestellung wurde storniert.";
  }
}

function paymentSummaryDe(
  isPaid: boolean,
  method: "cash" | "invoice" | "card" | "twint" | null,
): string {
  if (isPaid) {
    if (method === "cash") return "Bar bezahlt bei Lieferung.";
    if (method === "invoice") return "Rechnung bezahlt.";
    return "Bezahlt.";
  }
  if (method === "cash") return "Barzahlung bei Lieferung.";
  if (method === "invoice") return "Rechnung offen.";
  if (method === "card" || method === "twint") return "Zahlung ausstehend.";
  return "Zahlung offen.";
}

function buildSlotLabel(data: {
  fulfilment: "run" | "timed" | "pickup" | "post";
  requestedDeliveryAt: Date | null;
  deliveryDate: string | null;
  sortTime: string | null;
  run: { runDate: string; windowStart: string; windowEnd: string } | null;
}): string {
  if (data.fulfilment === "timed" && data.requestedDeliveryAt) {
    return (
      DateTime.fromJSDate(data.requestedDeliveryAt, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("cccc d. LLLL, HH:mm") + " Uhr (Zeremonie)"
    );
  }
  if (data.fulfilment === "run" && data.run) {
    const d = DateTime.fromISO(data.run.runDate, { zone: "Europe/Zurich" })
      .setLocale("de-CH")
      .toFormat("cccc d. LLLL");
    return `${d}, ${data.run.windowStart.slice(0, 5)}–${data.run.windowEnd.slice(0, 5)}`;
  }
  if (data.fulfilment === "pickup" && data.deliveryDate) {
    const d = DateTime.fromISO(data.deliveryDate, { zone: "Europe/Zurich" })
      .setLocale("de-CH")
      .toFormat("cccc d. LLLL");
    return `${d}, Abholung im Laden`;
  }
  return "Termin wird bestätigt";
}
