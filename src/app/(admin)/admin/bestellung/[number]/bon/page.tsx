import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import { fetchOrderDetail } from "@/lib/admin/order-detail";
import { contextLabelDe, paymentDisplayDe } from "@/lib/admin/heute";
import { formatChf } from "@/lib/money";
import { AutoPrint } from "./_components/auto-print";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bon",
  robots: { index: false, follow: false },
};

type PageProps = { params: Promise<{ number: string }> };

/**
 * Print layout for one Bon. Lives inside the (admin) route group so
 * it inherits auth from the layout, but hides the admin chrome via
 * @media print so paper only shows the Bon.
 *
 * window.print() is dispatched client-side (AutoPrint component)
 * and the order is marked printed in the same effect. The ⎙ icon
 * on Heute then reflects the print.
 */
export default async function BonPrintPage({ params }: PageProps) {
  await auth();
  const { number } = await params;
  const data = await fetchOrderDetail(decodeURIComponent(number));
  if (!data) notFound();
  const { order: o, lines, run } = data;

  const slot = buildSlotLabel(o, run);

  return (
    <>
      {/* Scoped print CSS: on paper, hide the admin header + sidebar
          nav and the on-screen padding so the Bon fills the page.
          Nothing marked `print:hidden` on the page is visible when
          printing. */}
      <style>{`
        @media print {
          /* Hide the (admin) layout header without touching other
             pages' print behaviour. Admin layout's <header> is the
             first element inside <body> above our content. */
          body > header, body > div > header,
          [data-admin-header="true"] {
            display: none !important;
          }
          .bon-screen-only { display: none !important; }
          body, html { background: #ffffff !important; color: #000000 !important; }
          main { padding: 0 !important; max-width: none !important; }
          .bon-page { padding: 12mm !important; }
          .bon-page a { color: #000000 !important; text-decoration: none !important; }
          @page { margin: 0; size: A5 portrait; }
        }
        .bon-page {
          font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
          color: #000;
          max-width: 148mm;
          margin: 0 auto;
          padding: 16px;
        }
        .bon-page h1 {
          font-size: 20px;
          margin: 0 0 2px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .bon-page h2 {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          color: #555;
          margin: 10px 0 4px;
        }
        .bon-page .bon-row {
          display: grid;
          grid-template-columns: 70px 1fr;
          gap: 6px;
          font-size: 12px;
          line-height: 1.45;
        }
        .bon-page .bon-row dt { color: #555; }
        .bon-page .bon-slot {
          font-size: 15px;
          font-weight: 600;
          padding: 6px 8px;
          border: 1px solid #000;
          text-align: center;
          margin: 8px 0;
        }
        .bon-page .bon-items {
          width: 100%;
          font-size: 12px;
          border-collapse: collapse;
          margin-top: 2px;
        }
        .bon-page .bon-items td {
          padding: 3px 0;
          border-bottom: 1px dotted #999;
          vertical-align: top;
        }
        .bon-page .bon-items .qty { width: 32px; text-align: right; font-variant-numeric: tabular-nums; }
        .bon-page .bon-items .amt { width: 70px; text-align: right; font-variant-numeric: tabular-nums; }
        .bon-page .bon-total {
          display: flex; justify-content: space-between;
          margin-top: 6px; padding-top: 4px; border-top: 1.5px solid #000;
          font-size: 13px; font-weight: 600;
        }
        .bon-page .bon-card {
          margin: 10px 0;
          padding: 8px 10px;
          border: 1px solid #000;
          font-style: italic;
          font-size: 12.5px;
        }
        .bon-page .bon-ribbon {
          margin: 6px 0;
          padding: 6px 10px;
          border: 1.5px solid #000;
          font-size: 12px;
          font-weight: 500;
          text-align: center;
          letter-spacing: 0.04em;
        }
        .bon-page .bon-badge {
          display: inline-block;
          padding: 2px 6px;
          border: 1px solid #000;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-weight: 600;
          margin-left: 6px;
        }
        .bon-page .bon-footer {
          margin-top: 14px;
          padding-top: 6px;
          border-top: 1px solid #000;
          font-size: 10px;
          text-align: center;
          color: #333;
        }
      `}</style>

      <AutoPrint orderNumber={o.orderNumber} />

      <div className="bon-page">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h1>Magenta Blumen</h1>
          <span style={{ fontSize: 11, color: "#555" }}>
            {DateTime.fromJSDate(o.placedAt, { zone: "Europe/Zurich" })
              .setLocale("de-CH")
              .toFormat("ccc d. LLL yyyy, HH:mm")}
          </span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "0.02em", marginTop: 2 }}>
          {o.orderNumber}
          {o.deliveryContext !== "residential" && (
            <span className="bon-badge">{contextLabelDe(o.deliveryContext)}</span>
          )}
        </div>

        <div className="bon-slot">{slot}</div>

        <h2>Lieferung an</h2>
        <dl className="bon-row">
          <dt>Empfänger</dt>
          <dd>
            <strong>{o.recipientName}</strong>
            {o.recipientPhone && <> · {o.recipientPhone}</>}
          </dd>
          <dt>Adresse</dt>
          <dd>
            {o.deliveryStreet}
            <br />
            {o.deliveryPlz} {o.deliveryCity}
            {o.deliveryZoneName && (
              <>
                <br />
                <span style={{ color: "#555", fontSize: 11 }}>
                  Zone {o.deliveryZoneName}
                </span>
              </>
            )}
          </dd>
          {o.deliveryContext === "hospital" && (o.deliveryWard || o.deliveryRoom) && (
            <>
              <dt>Station</dt>
              <dd>
                {o.deliveryWard}
                {o.deliveryRoom && `, Zimmer ${o.deliveryRoom}`}
              </dd>
            </>
          )}
          {o.deliveryContext === "funeral" && (
            <>
              {o.deceasedName && (
                <>
                  <dt>Verstorben</dt>
                  <dd>
                    <strong>{o.deceasedName}</strong>
                  </dd>
                </>
              )}
              {o.familyContactPhone && (
                <>
                  <dt>Familie</dt>
                  <dd>{o.familyContactPhone}</dd>
                </>
              )}
            </>
          )}
          {o.deliveryInstructions && (
            <>
              <dt>Hinweise</dt>
              <dd>{o.deliveryInstructions}</dd>
            </>
          )}
        </dl>

        <h2>Artikel</h2>
        <table className="bon-items">
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="qty">{l.quantity}×</td>
                <td>
                  <div>
                    <strong>{l.productNameDe}</strong>
                    {l.variantLabelDe && (
                      <> · {l.variantLabelDe}</>
                    )}
                  </div>
                  {(l.colourPreference || l.avoidNotes) && (
                    <div style={{ color: "#555", fontSize: 11 }}>
                      {l.colourPreference && (
                        <>Farbwunsch: {l.colourPreference}</>
                      )}
                      {l.colourPreference && l.avoidNotes && " · "}
                      {l.avoidNotes && <>Vermeiden: {l.avoidNotes}</>}
                    </div>
                  )}
                </td>
                <td className="amt">{formatChf(l.lineTotalGross)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="bon-total">
          <span>Total</span>
          <span>{formatChf(o.totalGross)}</span>
        </div>

        {o.cardMessage && (
          <>
            <h2>Karte</h2>
            <div className="bon-card">
              «{o.cardMessage}»
              {o.cardIsAnonymous && (
                <span style={{ fontStyle: "normal", color: "#555", marginLeft: 6 }}>
                  (anonym)
                </span>
              )}
            </div>
          </>
        )}

        {o.ribbonText && (
          <>
            <h2>Trauerband</h2>
            <div className="bon-ribbon">«{o.ribbonText}»</div>
          </>
        )}

        <h2>Käufer / Rechnung</h2>
        <dl className="bon-row">
          <dt>Name</dt>
          <dd>{o.buyerName}</dd>
          {o.buyerPhone && (
            <>
              <dt>Telefon</dt>
              <dd>{o.buyerPhone}</dd>
            </>
          )}
          <dt>E-Mail</dt>
          <dd>{o.buyerEmail}</dd>
          <dt>Zahlung</dt>
          <dd>
            {paymentDisplayDe(
              data.payments[0]?.status ?? null,
              data.payments[0]?.method ?? null,
            )}
          </dd>
        </dl>

        <div className="bon-footer">
          Magenta Blumen · Zürcherstrasse 142 · 5432 Neuenhof · 056 556 56 09
        </div>
      </div>

      {/* Only visible on screen - the Bon fills the paper by itself */}
      <div className="bon-screen-only" style={{ maxWidth: 580, margin: "16px auto", padding: "0 16px" }}>
        <p style={{ fontSize: 13, color: "#555" }}>
          Druck-Dialog öffnet automatisch. Falls nicht, bitte Strg+P
          (Windows) oder ⌘+P (Mac) drücken.
        </p>
      </div>
    </>
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
    return `${d} · ${run.windowStart.slice(0, 5)}–${run.windowEnd.slice(0, 5)}`;
  }
  if (order.deliveryDate) {
    const d = DateTime.fromISO(order.deliveryDate, { zone: "Europe/Zurich" })
      .setLocale("de-CH")
      .toFormat("cccc d. LLLL");
    return d;
  }
  return "Kein Termin";
}
