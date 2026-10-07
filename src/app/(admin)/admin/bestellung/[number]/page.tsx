import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import { fetchOrderDetail } from "@/lib/admin/order-detail";
import {
  contextLabelDe,
  paymentDisplayDe,
  statusLabelDe,
} from "@/lib/admin/heute";
import { formatChf } from "@/lib/money";
import { MarkPaidButton } from "./_components/mark-paid";
import { InternalNotesEditor } from "./_components/internal-notes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bestellung",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ number: string }>;
};

export default async function OrderDetailPage({ params }: PageProps) {
  await auth();
  const { number } = await params;
  const data = await fetchOrderDetail(decodeURIComponent(number));
  if (!data) notFound();
  const { order: o, lines, payments, refunds, run } = data;

  const livePayment = payments.find((p) => p.status !== "failed") ?? payments[0];
  const paidTotal = payments
    .filter((p) => p.status === "succeeded")
    .reduce((acc, p) => acc + Number(p.amountGross), 0);
  const refundedTotal = refunds.reduce(
    (acc, r) => acc + Number(r.amountGross),
    0,
  );

  const slotLabel = buildSlotLabel(o, run);

  const canMarkPaid =
    livePayment &&
    (livePayment.method === "cash" || livePayment.method === "invoice") &&
    livePayment.status !== "succeeded";

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/admin"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Heute
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight tabular-nums mt-1">
            {o.orderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            Bestellt am{" "}
            {DateTime.fromJSDate(o.placedAt, { zone: "Europe/Zurich" })
              .setLocale("de-CH")
              .toFormat("ccc d. LLL yyyy, HH:mm")}{" "}
            Uhr
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="inline-flex items-center gap-2 flex-wrap justify-end">
            <StatusBadge status={o.status} />
            <ContextBadge context={o.deliveryContext} />
          </div>
          <div className="text-xl font-semibold tabular-nums mt-2">
            {formatChf(o.totalGross)}
          </div>
        </div>
      </header>

      {/* Grid: left big column + right side panel */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="space-y-6">
          {/* Line items */}
          <section className="rounded-md border p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3">
              Artikel ({lines.length})
            </h2>
            <ul className="divide-y">
              {lines.map((l) => (
                <li
                  key={l.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 text-sm items-baseline"
                >
                  <div>
                    <div className="font-medium">{l.productNameDe}</div>
                    {l.variantLabelDe && (
                      <div className="text-xs text-muted-foreground">
                        {l.variantLabelDe}
                      </div>
                    )}
                    {(l.colourPreference || l.avoidNotes) && (
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        {l.colourPreference && (
                          <div>Farbwunsch: {l.colourPreference}</div>
                        )}
                        {l.avoidNotes && <div>Vermeiden: {l.avoidNotes}</div>}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums text-right">
                    {l.quantity} × {formatChf(l.unitPriceGross)}
                  </div>
                  <div className="tabular-nums font-medium text-right">
                    {formatChf(l.lineTotalGross)}
                  </div>
                </li>
              ))}
            </ul>
            <dl className="mt-4 pt-3 border-t text-sm space-y-1">
              <SumRow label="Zwischensumme" value={formatChf(o.subtotalGross)} />
              <SumRow
                label="Lieferung"
                value={
                  Number(o.deliveryFeeGross) === 0
                    ? "gratis"
                    : formatChf(o.deliveryFeeGross)
                }
              />
              {Number(o.giftcardAppliedGross) > 0 && (
                <SumRow
                  label="Gutschein"
                  value={`− ${formatChf(o.giftcardAppliedGross)}`}
                />
              )}
              <SumRow
                label="Total"
                value={formatChf(o.totalGross)}
                strong
              />
            </dl>
          </section>

          {/* Delivery */}
          <section className="rounded-md border p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3">
              Lieferung
            </h2>
            <dl className="text-sm space-y-1.5">
              <Row label="Termin" value={slotLabel} />
              <Row
                label="Zone"
                value={o.deliveryZoneName ?? "—"}
              />
              <Row label="Empfänger" value={o.recipientName} />
              {o.recipientPhone && (
                <Row
                  label="Empfänger Tel."
                  value={
                    <a href={`tel:${o.recipientPhone}`} className="hover:underline">
                      {o.recipientPhone}
                    </a>
                  }
                />
              )}
              <Row
                label="Adresse"
                value={[o.deliveryStreet, o.deliveryPlz, o.deliveryCity]
                  .filter(Boolean)
                  .join(", ")}
              />
              {o.deliveryContext === "hospital" && (
                <>
                  {o.deliveryWard && (
                    <Row label="Station" value={o.deliveryWard} />
                  )}
                  {o.deliveryRoom && (
                    <Row label="Zimmer" value={o.deliveryRoom} />
                  )}
                </>
              )}
              {o.deliveryContext === "funeral" && (
                <>
                  {o.deceasedName && (
                    <Row label="Verstorben" value={o.deceasedName} />
                  )}
                  {o.familyContactPhone && (
                    <Row
                      label="Familienkontakt"
                      value={
                        <a
                          href={`tel:${o.familyContactPhone}`}
                          className="hover:underline"
                        >
                          {o.familyContactPhone}
                        </a>
                      }
                    />
                  )}
                </>
              )}
              {o.deliveryInstructions && (
                <Row label="Hinweise" value={o.deliveryInstructions} />
              )}
            </dl>
          </section>

          {/* Card + ribbon */}
          {(o.cardMessage || o.ribbonText) && (
            <section className="rounded-md border p-4 space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide">
                Karte / Band
              </h2>
              {o.cardMessage && (
                <blockquote className="text-sm bg-muted/40 border-l-4 border-rose-500 px-3 py-2 italic">
                  «{o.cardMessage}»
                  {o.cardIsAnonymous && (
                    <span className="not-italic text-xs text-muted-foreground ml-2">
                      (anonym)
                    </span>
                  )}
                </blockquote>
              )}
              {o.ribbonText && (
                <div className="text-sm">
                  <span className="font-medium">Trauerband:</span> «{o.ribbonText}»
                </div>
              )}
            </section>
          )}

          {/* Internal notes */}
          <section className="rounded-md border p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3">
              Interne Notizen
            </h2>
            <InternalNotesEditor
              orderNumber={o.orderNumber}
              initial={o.internalNotes}
            />
          </section>
        </div>

        {/* Right side: buyer + payment */}
        <aside className="space-y-6 lg:sticky lg:top-6">
          <section className="rounded-md border p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3">
              Käufer
            </h2>
            <dl className="text-sm space-y-1.5">
              <Row label="Name" value={o.buyerName} />
              <Row
                label="E-Mail"
                value={
                  <a href={`mailto:${o.buyerEmail}`} className="hover:underline break-all">
                    {o.buyerEmail}
                  </a>
                }
              />
              {o.buyerPhone && (
                <Row
                  label="Telefon"
                  value={
                    <a href={`tel:${o.buyerPhone}`} className="hover:underline">
                      {o.buyerPhone}
                    </a>
                  }
                />
              )}
            </dl>
          </section>

          <section className="rounded-md border p-4 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Zahlung
            </h2>
            {livePayment ? (
              <>
                <dl className="text-sm space-y-1.5">
                  <Row
                    label="Methode / Status"
                    value={paymentDisplayDe(
                      livePayment.status,
                      livePayment.method,
                    )}
                  />
                  <Row
                    label="Betrag"
                    value={formatChf(livePayment.amountGross)}
                  />
                  {livePayment.paidAt && (
                    <Row
                      label="Bezahlt am"
                      value={DateTime.fromJSDate(livePayment.paidAt, {
                        zone: "Europe/Zurich",
                      })
                        .setLocale("de-CH")
                        .toFormat("ccc d. LLL, HH:mm")}
                    />
                  )}
                  {livePayment.markedPaidBy && (
                    <Row label="Markiert von" value={livePayment.markedPaidBy} />
                  )}
                  {livePayment.providerPaymentIntentId && (
                    <Row
                      label="Stripe"
                      value={
                        <span className="font-mono text-xs break-all">
                          {livePayment.providerPaymentIntentId}
                        </span>
                      }
                    />
                  )}
                </dl>
                {canMarkPaid && (
                  <div className="pt-2 border-t">
                    <MarkPaidButton paymentId={livePayment.id} />
                  </div>
                )}
                {refundedTotal > 0 && (
                  <div className="pt-2 border-t text-sm">
                    <div className="text-muted-foreground">Erstattet</div>
                    <div className="font-medium tabular-nums">
                      {formatChf(refundedTotal.toFixed(2))}
                    </div>
                  </div>
                )}
                {paidTotal > 0 && paidTotal !== Number(o.amountDueGross) && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Hinweis: Bezahlter Betrag (
                    {formatChf(paidTotal.toFixed(2))}) weicht vom
                    Rechnungsbetrag ({formatChf(o.amountDueGross)}) ab.
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine Zahlung erfasst (Gutschein deckt den gesamten Betrag).
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Small UI helpers
// ------------------------------------------------------------------

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
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
    <div className={`flex justify-between ${strong ? "font-semibold pt-1 border-t" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: ReturnType<typeof fetchOrderDetail> extends Promise<infer T>
    ? T extends { order: { status: infer S } }
      ? S
      : never
    : never;
}) {
  // We can't infer the enum cleanly from the type above in all TS
  // versions; cast at the boundary.
  const s = status as
    | "new"
    | "confirmed"
    | "in_production"
    | "ready"
    | "out_for_delivery"
    | "delivered"
    | "delivery_failed"
    | "cancelled";
  const tone =
    s === "delivered"
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : s === "out_for_delivery"
        ? "bg-sky-100 text-sky-700 border-sky-200"
        : s === "ready"
          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
          : s === "in_production"
            ? "bg-amber-100 text-amber-700 border-amber-200"
            : s === "delivery_failed"
              ? "bg-rose-100 text-rose-700 border-rose-200"
              : s === "cancelled"
                ? "bg-slate-100 text-slate-500 border-slate-200 line-through"
                : "bg-stone-100 text-stone-700 border-stone-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${tone}`}
    >
      {statusLabelDe(s)}
    </span>
  );
}

function ContextBadge({
  context,
}: {
  context: "residential" | "business" | "hospital" | "funeral";
}) {
  if (context === "residential") return null;
  const tone =
    context === "funeral"
      ? "bg-rose-100 text-rose-700 border-rose-200"
      : context === "hospital"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded ${tone}`}
    >
      {contextLabelDe(context)}
    </span>
  );
}

function buildSlotLabel(
  o: Awaited<ReturnType<typeof fetchOrderDetail>> extends infer T
    ? T extends { order: infer O }
      ? O
      : never
    : never,
  run:
    | {
        runDate: string;
        windowStart: string;
        windowEnd: string;
      }
    | null,
): string {
  const order = o as {
    fulfilment: "run" | "timed" | "pickup" | "post";
    requestedDeliveryAt: Date | null;
    deliveryDate: string | null;
    sortTime: string | null;
  };

  if (order.fulfilment === "timed" && order.requestedDeliveryAt) {
    return (
      DateTime.fromJSDate(order.requestedDeliveryAt, {
        zone: "Europe/Zurich",
      })
        .setLocale("de-CH")
        .toFormat("cccc d. LLLL, HH:mm") + " Uhr (Zeremonie)"
    );
  }
  if (order.fulfilment === "run" && run) {
    const d = DateTime.fromISO(run.runDate, { zone: "Europe/Zurich" })
      .setLocale("de-CH")
      .toFormat("cccc d. LLLL");
    return `${d}, ${run.windowStart.slice(0, 5)}–${run.windowEnd.slice(0, 5)}`;
  }
  if (order.deliveryDate) {
    const d = DateTime.fromISO(order.deliveryDate, { zone: "Europe/Zurich" })
      .setLocale("de-CH")
      .toFormat("cccc d. LLLL");
    const window = order.sortTime
      ? order.sortTime.startsWith("10")
        ? ", 10:00–12:00"
        : order.sortTime.startsWith("16")
          ? ", 16:00–18:00"
          : `, ${order.sortTime.slice(0, 5)}`
      : "";
    return `${d}${window}`;
  }
  return "Kein Termin";
}
