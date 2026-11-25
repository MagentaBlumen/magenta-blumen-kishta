import "server-only";
import { DateTime } from "luxon";

/**
 * HTML email templates. Plain string concatenation on purpose:
 *
 *   - Two emails total; a templating engine would be overkill.
 *   - Email HTML has to work in Outlook, Gmail, Apple Mail, etc.
 *     Inline styles + tables is the safe path. React Email would be
 *     an extra dep and gets us the same end result.
 *   - No external images (Google / Outlook block them by default).
 *     The shop address + phone sit in the footer as plain text.
 *
 * Every helper returns { subject, html, text }. The plain-text version
 * is for mail clients that don't render HTML (and for spam-filter
 * sanity).
 */

export type OrderEmailLine = {
  productNameDe: string;
  variantLabelDe: string | null;
  quantity: number;
  unitPriceGross: string;   // 'CHF 45.00' or numeric string
  lineTotalGross: string;
  /** Snapshot of order_line.tax_rate (e.g. '0.0260', '0.0810'). */
  taxRate: string | null;
};

export type OrderEmailData = {
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  recipientName: string;
  recipientPhone: string | null;
  deliveryStreet: string;
  deliveryPlz: string;
  deliveryCity: string;
  deliveryZoneName: string;
  fulfilment: "run" | "timed" | "pickup" | "post";
  /** YYYY-MM-DD */
  deliveryDate: string | null;
  /** HH:MM or HH:MM:SS */
  sortTime: string | null;
  /** full timestamp for timed orders */
  requestedDeliveryAt: Date | null;
  cardMessage: string | null;
  cardIsAnonymous: boolean;
  ribbonText: string | null;
  deliveryInstructions: string | null;
  deliveryContext: "residential" | "business" | "hospital" | "funeral";
  deliveryWard: string | null;
  deliveryRoom: string | null;
  deceasedName: string | null;
  familyContactPhone: string | null;
  subtotalGross: string;
  deliveryFeeGross: string;
  /** Snapshot of order.delivery_fee_tax_rate (e.g. '0.0260', '0.0810'). */
  deliveryFeeTaxRate: string | null;
  totalGross: string;
  paymentMethod: "cash" | "invoice" | "card" | "twint";
  lines: OrderEmailLine[];
};

export type VatBreakdownRow = {
  /** '0.0260' or '0.0810' */
  rate: string;
  /** '2.6' / '8.1' for display */
  ratePct: string;
  /** Gross sum at this rate, two-decimal string. */
  grossAmount: string;
  /** VAT included in that gross, two-decimal string. */
  vatAmount: string;
  /** Net = gross − VAT, two-decimal string. */
  netAmount: string;
};

/**
 * Group gross amounts by tax rate and derive net + VAT per rate.
 *
 * Mandatory for Art. 26 MWSTG compliance when the order mixes rates
 * (per docs/vat-rates.md): a bouquet (2.6%) + vase (8.1%) must render
 * as two rate lines, not one blended figure.
 *
 * Inputs are snapshotted `order_line.tax_rate` / `order.delivery_fee_tax_rate`
 * strings in `numeric(5,4)` shape ('0.0260', '0.0810'). Lines with a
 * null rate are skipped — the row cannot be grouped. The delivery fee is
 * only included when both its rate and amount are non-null / non-zero.
 */
export function computeVatBreakdown(
  lines: OrderEmailLine[],
  deliveryFeeGross: string,
  deliveryFeeTaxRate: string | null,
): VatBreakdownRow[] {
  const byRate = new Map<string, number>();
  for (const l of lines) {
    if (!l.taxRate) continue;
    const gross = Number(l.lineTotalGross);
    if (!Number.isFinite(gross)) continue;
    byRate.set(l.taxRate, (byRate.get(l.taxRate) ?? 0) + gross);
  }
  const feeAmount = Number(deliveryFeeGross);
  if (deliveryFeeTaxRate && Number.isFinite(feeAmount) && feeAmount > 0) {
    byRate.set(
      deliveryFeeTaxRate,
      (byRate.get(deliveryFeeTaxRate) ?? 0) + feeAmount,
    );
  }

  const rows: VatBreakdownRow[] = [];
  const ratesSorted = Array.from(byRate.keys()).sort((a, b) =>
    Number(a) - Number(b),
  );
  for (const rate of ratesSorted) {
    const gross = round2(byRate.get(rate) ?? 0);
    const r = Number(rate);
    const vat = round2((gross * r) / (1 + r));
    const net = round2(gross - vat);
    rows.push({
      rate,
      ratePct: formatRatePct(r),
      grossAmount: gross.toFixed(2),
      vatAmount: vat.toFixed(2),
      netAmount: net.toFixed(2),
    });
  }
  return rows;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatRatePct(r: number): string {
  // 0.026 -> "2.6", 0.081 -> "8.1". Trim a trailing zero but keep one
  // decimal if the rate has one (e.g. 0.077 -> "7.7").
  const pct = r * 100;
  const fixed = pct.toFixed(1);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

// ------------------------------------------------------------------
// Buyer confirmation
// ------------------------------------------------------------------

export function buyerConfirmationEmail(
  o: OrderEmailData,
  orderDeepLinkUrl: string,
): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Ihre Bestellung ${o.orderNumber} bei Magenta Blumen`;

  const deliveryLabel = slotLabelDe(o);
  const paymentLabel = paymentMethodLabelDe(o.paymentMethod);
  const lookupUrl = orderDeepLinkUrl;
  const lookupLabel = "Bestellung öffnen";
  const vatBreakdown = computeVatBreakdown(
    o.lines,
    o.deliveryFeeGross,
    o.deliveryFeeTaxRate,
  );

  const vatRowsHtml = vatBreakdown
    .map(
      (v) => `
                <tr>
                  <td style="padding:2px 0;color:#4f6752;font-size:13px;">
                    MWST ${v.ratePct}% · netto ${formatChfInline(v.netAmount)} + MWST ${formatChfInline(v.vatAmount)}
                  </td>
                  <td style="padding:2px 0;text-align:right;font-variant-numeric:tabular-nums;font-size:13px;">
                    ${formatChfInline(v.grossAmount)}
                  </td>
                </tr>`,
    )
    .join("");

  const linesHtml = o.lines
    .map(
      (l) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #ede9e3;">
            ${escapeHtml(l.productNameDe)}
            ${l.variantLabelDe ? ` <span style="color:#4f6752;">(${escapeHtml(l.variantLabelDe)})</span>` : ""}
            <div style="color:#4f6752;font-size:12px;">${l.quantity} × ${formatChfInline(l.unitPriceGross)}</div>
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #ede9e3;text-align:right;font-variant-numeric:tabular-nums;">
            ${formatChfInline(l.lineTotalGross)}
          </td>
        </tr>`,
    )
    .join("");

  const html = `
<!doctype html>
<html lang="de-CH">
  <body style="margin:0;padding:0;background:#fdfcf9;font-family:'DM Sans',system-ui,sans-serif;color:#2a1f1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdfcf9;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ede9e3;">
          <tr>
            <td style="padding:28px 32px;border-bottom:1px solid #ede9e3;">
              <div style="font-family:Cormorant,Georgia,serif;font-size:24px;color:#2a1f1a;font-weight:300;">Magenta Blumen</div>
              <div style="color:#4f6752;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;margin-top:4px;">Bestellbestätigung</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                Guten Tag ${escapeHtml(o.buyerName)}
              </p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
                Vielen Dank für Ihre Bestellung. Wir haben Ihren Liefertermin für Sie reserviert.
              </p>
              <div style="background:#f9f6f1;border:1px solid #ede9e3;padding:14px 16px;margin:16px 0;">
                <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#4f6752;">Bestellnummer</div>
                <div style="font-family:Cormorant,Georgia,serif;font-size:22px;color:#2a1f1a;margin-top:4px;">${escapeHtml(o.orderNumber)}</div>
              </div>

              <h2 style="font-family:Cormorant,Georgia,serif;font-size:18px;font-weight:400;margin:24px 0 8px;color:#2a1f1a;">Lieferung</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                <tr>
                  <td style="padding:4px 0;color:#4f6752;width:120px;">Termin</td>
                  <td style="padding:4px 0;">${escapeHtml(deliveryLabel)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#4f6752;">An</td>
                  <td style="padding:4px 0;">
                    ${escapeHtml(o.recipientName)}<br>
                    ${escapeHtml(o.deliveryStreet)}<br>
                    ${escapeHtml(o.deliveryPlz)} ${escapeHtml(o.deliveryCity)}
                    ${o.deliveryContext === "hospital" && o.deliveryWard ? `<br>Station ${escapeHtml(o.deliveryWard)}${o.deliveryRoom ? `, Zimmer ${escapeHtml(o.deliveryRoom)}` : ""}` : ""}
                  </td>
                </tr>
              </table>

              <h2 style="font-family:Cormorant,Georgia,serif;font-size:18px;font-weight:400;margin:24px 0 8px;color:#2a1f1a;">Artikel</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
                ${linesHtml}
                <tr>
                  <td style="padding:12px 0 4px;color:#4f6752;">Zwischensumme</td>
                  <td style="padding:12px 0 4px;text-align:right;font-variant-numeric:tabular-nums;">${formatChfInline(o.subtotalGross)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;color:#4f6752;">Lieferung</td>
                  <td style="padding:4px 0;text-align:right;font-variant-numeric:tabular-nums;">${Number(o.deliveryFeeGross) === 0 ? "gratis" : formatChfInline(o.deliveryFeeGross)}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0 0;border-top:1px solid #ede9e3;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#2a1f1a;">Total</td>
                  <td style="padding:8px 0 0;border-top:1px solid #ede9e3;text-align:right;font-family:Cormorant,Georgia,serif;font-size:20px;color:#2a1f1a;">${formatChfInline(o.totalGross)}</td>
                </tr>
                ${
                  vatBreakdown.length > 0
                    ? `<tr>
                         <td colspan="2" style="padding:12px 0 2px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#4f6752;">
                           MWST-Aufschlüsselung (im Total enthalten)
                         </td>
                       </tr>
                       ${vatRowsHtml}`
                    : ""
                }
              </table>

              <h2 style="font-family:Cormorant,Georgia,serif;font-size:18px;font-weight:400;margin:24px 0 8px;color:#2a1f1a;">Zahlung</h2>
              <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">${escapeHtml(paymentLabel)}</p>

              ${
                o.cardMessage
                  ? `
              <h2 style="font-family:Cormorant,Georgia,serif;font-size:18px;font-weight:400;margin:24px 0 8px;color:#2a1f1a;">Karte</h2>
              <blockquote style="margin:0;padding:12px 16px;background:#f9f6f1;border-left:3px solid #a0185a;font-style:italic;font-size:14px;line-height:1.6;">
                «${escapeHtml(o.cardMessage)}»${o.cardIsAnonymous ? ' <span style="color:#4f6752;font-style:normal;">(anonym)</span>' : ""}
              </blockquote>`
                  : ""
              }

              <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#4f6752;">
                Status jederzeit prüfen:
                <a href="${lookupUrl}" style="color:#a0185a;">${lookupLabel}</a>
              </p>
              <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#4f6752;">
                Bei Fragen erreichen Sie uns unter <a href="tel:+41565565609" style="color:#a0185a;">056 556 56 09</a>
                oder <a href="mailto:info@magenta-blumen.ch" style="color:#a0185a;">info@magenta-blumen.ch</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #ede9e3;color:#4f6752;font-size:11px;letter-spacing:0.08em;">
              Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  const text = [
    `Magenta Blumen - Bestellbestätigung`,
    ``,
    `Guten Tag ${o.buyerName},`,
    ``,
    `Vielen Dank für Ihre Bestellung. Wir haben Ihren Liefertermin für Sie reserviert.`,
    ``,
    `Bestellnummer: ${o.orderNumber}`,
    `Termin: ${deliveryLabel}`,
    ``,
    `An:`,
    `  ${o.recipientName}`,
    `  ${o.deliveryStreet}`,
    `  ${o.deliveryPlz} ${o.deliveryCity}`,
    ``,
    `Artikel:`,
    ...o.lines.map(
      (l) =>
        `  ${l.quantity} x ${l.productNameDe}${l.variantLabelDe ? ` (${l.variantLabelDe})` : ""}  -  ${formatChfInline(l.lineTotalGross)}`,
    ),
    ``,
    `Zwischensumme: ${formatChfInline(o.subtotalGross)}`,
    `Lieferung:    ${Number(o.deliveryFeeGross) === 0 ? "gratis" : formatChfInline(o.deliveryFeeGross)}`,
    `Total:        ${formatChfInline(o.totalGross)}`,
    ...(vatBreakdown.length > 0
      ? [
          ``,
          `MWST-Aufschlüsselung (im Total enthalten):`,
          ...vatBreakdown.map(
            (v) =>
              `  ${v.ratePct}%: netto ${formatChfInline(v.netAmount)} + MWST ${formatChfInline(v.vatAmount)} = ${formatChfInline(v.grossAmount)}`,
          ),
        ]
      : []),
    ``,
    `Zahlung: ${paymentLabel}`,
    o.cardMessage
      ? `\nKarte: «${o.cardMessage}»${o.cardIsAnonymous ? " (anonym)" : ""}`
      : ``,
    ``,
    `Status jederzeit prüfen: ${lookupUrl}`,
    ``,
    `Bei Fragen: 056 556 56 09 oder info@magenta-blumen.ch`,
    ``,
    `Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST`,
  ].join("\n");

  return { subject, html, text };
}

// ------------------------------------------------------------------
// Shop notification
// ------------------------------------------------------------------

export function shopNotificationEmail(o: OrderEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[${o.deliveryContext === "funeral" ? "TRAUER " : ""}Neue Bestellung] ${o.orderNumber} - ${slotLabelShortDe(o)}`;

  const linesHtml = o.lines
    .map(
      (l) =>
        `<tr><td style="padding:4px 0;">${l.quantity} × ${escapeHtml(l.productNameDe)}${l.variantLabelDe ? ` (${escapeHtml(l.variantLabelDe)})` : ""}</td><td style="padding:4px 0;text-align:right;">${formatChfInline(l.lineTotalGross)}</td></tr>`,
    )
    .join("");

  // Shop email is deliberately terse. One screen, no fluff. Enough to
  // know what, when, where, who. Full detail is in /admin.
  const html = `
<!doctype html>
<html lang="de-CH">
  <body style="margin:0;padding:0;background:#fdfcf9;font-family:'DM Sans',system-ui,sans-serif;color:#2a1f1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:16px;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #ede9e3;">
          <tr><td style="padding:20px 24px;background:#2a1f1a;color:#fdfcf9;">
            <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">Neue Bestellung</div>
            <div style="font-family:Cormorant,Georgia,serif;font-size:22px;margin-top:4px;">${escapeHtml(o.orderNumber)}</div>
          </td></tr>
          <tr><td style="padding:20px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
              <tr><td style="padding:4px 0;color:#4f6752;width:110px;">Termin</td><td style="padding:4px 0;"><strong>${escapeHtml(slotLabelDe(o))}</strong></td></tr>
              <tr><td style="padding:4px 0;color:#4f6752;">Zone</td><td style="padding:4px 0;">${escapeHtml(o.deliveryZoneName)}</td></tr>
              <tr><td style="padding:4px 0;color:#4f6752;">Empfänger</td><td style="padding:4px 0;">${escapeHtml(o.recipientName)}${o.recipientPhone ? ` · ${escapeHtml(o.recipientPhone)}` : ""}</td></tr>
              <tr><td style="padding:4px 0;color:#4f6752;">Adresse</td><td style="padding:4px 0;">${escapeHtml(o.deliveryStreet)}, ${escapeHtml(o.deliveryPlz)} ${escapeHtml(o.deliveryCity)}</td></tr>
              <tr><td style="padding:4px 0;color:#4f6752;">Kontext</td><td style="padding:4px 0;">${deliveryContextLabelDe(o.deliveryContext)}</td></tr>
              ${
                o.deliveryContext === "hospital" && o.deliveryWard
                  ? `<tr><td style="padding:4px 0;color:#4f6752;">Station</td><td style="padding:4px 0;"><strong>${escapeHtml(o.deliveryWard)}</strong>${o.deliveryRoom ? `, Zimmer ${escapeHtml(o.deliveryRoom)}` : ""}</td></tr>`
                  : ""
              }
              ${
                o.deliveryContext === "funeral"
                  ? `<tr><td style="padding:4px 0;color:#4f6752;">Verstorben</td><td style="padding:4px 0;"><strong>${escapeHtml(o.deceasedName ?? "")}</strong></td></tr>
                     <tr><td style="padding:4px 0;color:#4f6752;">Familie</td><td style="padding:4px 0;">${escapeHtml(o.familyContactPhone ?? "")}</td></tr>`
                  : ""
              }
              <tr><td style="padding:12px 0 4px;color:#4f6752;border-top:1px solid #ede9e3;" colspan="2">Rechnung</td></tr>
              <tr><td style="padding:4px 0;color:#4f6752;">Käufer</td><td style="padding:4px 0;">${escapeHtml(o.buyerName)}</td></tr>
              <tr><td style="padding:4px 0;color:#4f6752;">Telefon</td><td style="padding:4px 0;"><a href="tel:${escapeHtml(o.buyerPhone)}" style="color:#2a1f1a;">${escapeHtml(o.buyerPhone)}</a></td></tr>
              <tr><td style="padding:4px 0;color:#4f6752;">E-Mail</td><td style="padding:4px 0;">${escapeHtml(o.buyerEmail)}</td></tr>
              <tr><td style="padding:4px 0;color:#4f6752;">Zahlung</td><td style="padding:4px 0;">${escapeHtml(paymentMethodLabelDe(o.paymentMethod))}</td></tr>
            </table>

            <h2 style="font-family:Cormorant,Georgia,serif;font-size:16px;font-weight:400;margin:16px 0 4px;color:#2a1f1a;">Artikel</h2>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
              ${linesHtml}
              <tr><td style="padding:8px 0 0;border-top:1px solid #ede9e3;font-weight:600;">Total</td><td style="padding:8px 0 0;border-top:1px solid #ede9e3;text-align:right;font-weight:600;">${formatChfInline(o.totalGross)}</td></tr>
            </table>

            ${
              o.cardMessage
                ? `<h2 style="font-family:Cormorant,Georgia,serif;font-size:16px;font-weight:400;margin:16px 0 4px;color:#2a1f1a;">Karte</h2>
                   <blockquote style="margin:0;padding:8px 12px;background:#f9f6f1;border-left:3px solid #a0185a;font-style:italic;font-size:14px;">«${escapeHtml(o.cardMessage)}»${o.cardIsAnonymous ? " <em>(anonym)</em>" : ""}</blockquote>`
                : ""
            }
            ${
              o.ribbonText
                ? `<p style="margin:12px 0 0;font-size:14px;"><strong>Trauerband:</strong> «${escapeHtml(o.ribbonText)}»</p>`
                : ""
            }
            ${
              o.deliveryInstructions
                ? `<p style="margin:12px 0 0;font-size:13px;color:#4f6752;"><strong style="color:#2a1f1a;">Hinweise:</strong> ${escapeHtml(o.deliveryInstructions)}</p>`
                : ""
            }
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  const text = [
    `NEUE BESTELLUNG ${o.orderNumber}`,
    `${slotLabelDe(o)}  -  Zone ${o.deliveryZoneName}`,
    ``,
    `Empfänger: ${o.recipientName}${o.recipientPhone ? ` (${o.recipientPhone})` : ""}`,
    `Adresse:   ${o.deliveryStreet}, ${o.deliveryPlz} ${o.deliveryCity}`,
    `Kontext:   ${deliveryContextLabelDe(o.deliveryContext)}`,
    o.deliveryContext === "hospital" && o.deliveryWard
      ? `Station:   ${o.deliveryWard}${o.deliveryRoom ? `, Zimmer ${o.deliveryRoom}` : ""}`
      : "",
    o.deliveryContext === "funeral"
      ? `Verstorben: ${o.deceasedName ?? ""}\nFamilie:    ${o.familyContactPhone ?? ""}`
      : "",
    ``,
    `Käufer:  ${o.buyerName}`,
    `Telefon: ${o.buyerPhone}`,
    `E-Mail:  ${o.buyerEmail}`,
    `Zahlung: ${paymentMethodLabelDe(o.paymentMethod)}`,
    ``,
    `Artikel:`,
    ...o.lines.map(
      (l) =>
        `  ${l.quantity} x ${l.productNameDe}${l.variantLabelDe ? ` (${l.variantLabelDe})` : ""}  -  ${formatChfInline(l.lineTotalGross)}`,
    ),
    `Total: ${formatChfInline(o.totalGross)}`,
    o.cardMessage ? `\nKarte: «${o.cardMessage}»${o.cardIsAnonymous ? " (anonym)" : ""}` : "",
    o.ribbonText ? `Trauerband: «${o.ribbonText}»` : "",
    o.deliveryInstructions ? `Hinweise: ${o.deliveryInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text };
}

// ------------------------------------------------------------------
// Buyer status-transition emails
// ------------------------------------------------------------------
// Fire exactly when the admin flips to:
//   out_for_delivery  -> "unterwegs"
//   delivered         -> "zugestellt"
//   delivery_failed   -> "fehlgeschlagen"
// Not fired on earlier statuses (new/confirmed/in_production/ready).
// Those are noise - the buyer doesn't need an email every time
// Sandra ticks another workflow box.

export type StatusEmailKind =
  | "unterwegs"
  | "zugestellt"
  | "fehlgeschlagen"
  | "storniert";

export function buyerStatusEmail(
  o: OrderEmailData,
  kind: StatusEmailKind,
  orderDeepLinkUrl: string,
): { subject: string; html: string; text: string } {
  const lookupUrl = orderDeepLinkUrl;
  const lookupLabel = "Bestellung öffnen";

  const copy = statusEmailCopy(kind, o);

  const html = `
<!doctype html>
<html lang="de-CH">
  <body style="margin:0;padding:0;background:#fdfcf9;font-family:'DM Sans',system-ui,sans-serif;color:#2a1f1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ede9e3;">
          <tr><td style="padding:24px 32px 8px;">
            <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#4f6752;">
              Magenta Blumen
            </div>
          </td></tr>
          <tr><td style="padding:8px 32px 24px;">
            <h1 style="font-family:Cormorant,Georgia,serif;font-size:28px;font-weight:400;color:#2a1f1a;margin:0 0 16px;">
              ${escapeHtml(copy.heading)}
            </h1>
            <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
              ${copy.htmlBody}
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;font-size:14px;">
              <tr><td style="padding:4px 0;color:#4f6752;width:120px;">Bestellnummer</td><td style="padding:4px 0;font-family:monospace;">${escapeHtml(o.orderNumber)}</td></tr>
              <tr><td style="padding:4px 0;color:#4f6752;">Empfänger</td><td style="padding:4px 0;">${escapeHtml(o.recipientName)}</td></tr>
            </table>

            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#4f6752;">
              Status jederzeit prüfen:
              <a href="${lookupUrl}" style="color:#a0185a;">${lookupLabel}</a>
            </p>
            <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#4f6752;">
              Bei Fragen erreichen Sie uns unter
              <a href="tel:+41565565609" style="color:#a0185a;">056 556 56 09</a>
              oder <a href="mailto:info@magenta-blumen.ch" style="color:#a0185a;">info@magenta-blumen.ch</a>.
            </p>
          </td></tr>
          <tr><td style="padding:16px 32px;border-top:1px solid #ede9e3;color:#4f6752;font-size:11px;letter-spacing:0.08em;">
            Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  const text = [
    `Magenta Blumen`,
    ``,
    copy.heading,
    ``,
    copy.textBody,
    ``,
    `Bestellnummer: ${o.orderNumber}`,
    `Empfänger: ${o.recipientName}`,
    ``,
    `Status jederzeit prüfen: ${lookupUrl}`,
    ``,
    `Bei Fragen: 056 556 56 09 oder info@magenta-blumen.ch`,
    ``,
    `Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST`,
  ].join("\n");

  return { subject: copy.subject, html, text };
}

function statusEmailCopy(
  kind: StatusEmailKind,
  o: OrderEmailData,
): { subject: string; heading: string; htmlBody: string; textBody: string } {
  const slot = slotLabelDe(o);
  switch (kind) {
    case "unterwegs":
      return {
        subject: `Ihre Bestellung ${o.orderNumber} ist unterwegs`,
        heading: "Ihre Blumen sind unterwegs.",
        htmlBody: `Guten Tag ${escapeHtml(o.buyerName)},<br/><br/>
          Unsere Fahrerin ist mit Ihrer Bestellung auf dem Weg zum
          Empfänger. Geplantes Lieferfenster: <strong>${escapeHtml(slot)}</strong>.`,
        textBody: `Guten Tag ${o.buyerName},

Unsere Fahrerin ist mit Ihrer Bestellung auf dem Weg zum Empfänger. Geplantes Lieferfenster: ${slot}.`,
      };
    case "zugestellt":
      return {
        subject: `Ihre Bestellung ${o.orderNumber} wurde zugestellt`,
        heading: "Zugestellt. Danke für Ihr Vertrauen.",
        htmlBody: `Guten Tag ${escapeHtml(o.buyerName)},<br/><br/>
          Ihre Bestellung wurde soeben an <strong>${escapeHtml(o.recipientName)}</strong>
          zugestellt. Wir hoffen, die Blumen bereiten Freude.`,
        textBody: `Guten Tag ${o.buyerName},

Ihre Bestellung wurde soeben an ${o.recipientName} zugestellt. Wir hoffen, die Blumen bereiten Freude.`,
      };
    case "fehlgeschlagen":
      return {
        subject: `Ihre Bestellung ${o.orderNumber}: Zustellung nicht möglich`,
        heading: "Zustellung nicht möglich.",
        htmlBody: `Guten Tag ${escapeHtml(o.buyerName)},<br/><br/>
          Wir konnten die Blumen leider nicht zustellen - etwa weil
          niemand angetroffen wurde oder die Adresse nicht erreichbar
          war. Wir melden uns bei Ihnen zur Absprache. Falls Sie uns
          zuvorkommen möchten, rufen Sie uns bitte an.`,
        textBody: `Guten Tag ${o.buyerName},

Wir konnten die Blumen leider nicht zustellen - etwa weil niemand angetroffen wurde oder die Adresse nicht erreichbar war. Wir melden uns bei Ihnen zur Absprache. Falls Sie uns zuvorkommen möchten, rufen Sie uns bitte an.`,
      };
    case "storniert":
      return {
        subject: `Ihre Bestellung ${o.orderNumber} wurde storniert`,
        heading: "Ihre Bestellung wurde storniert.",
        htmlBody: `Guten Tag ${escapeHtml(o.buyerName)},<br/><br/>
          Ihre Bestellung wurde storniert. Falls Sie bereits bezahlt
          haben (Karte oder TWINT), erstatten wir den Betrag
          innerhalb der nächsten Werktage automatisch auf die
          ursprüngliche Zahlungsart zurück. Bei Fragen melden Sie sich
          bitte telefonisch.`,
        textBody: `Guten Tag ${o.buyerName},

Ihre Bestellung wurde storniert. Falls Sie bereits bezahlt haben (Karte oder TWINT), erstatten wir den Betrag innerhalb der nächsten Werktage automatisch auf die ursprüngliche Zahlungsart zurück. Bei Fragen melden Sie sich bitte telefonisch.`,
      };
  }
}

// ------------------------------------------------------------------
// Account lifecycle — welcome / email verification / password reset
// ------------------------------------------------------------------

export type AccountEmailCustomer = {
  firstName: string | null;
  lastName: string | null;
  email: string;
};

function displayName(c: AccountEmailCustomer): string {
  const joined = [c.firstName, c.lastName].filter(Boolean).join(" ");
  return joined || c.email.split("@")[0];
}

export function welcomeVerifyEmail(
  c: AccountEmailCustomer,
  verifyUrl: string,
): { subject: string; html: string; text: string } {
  const name = displayName(c);
  const subject = "Willkommen bei Magenta Blumen";
  const html = accountShell({
    heading: "Willkommen bei Magenta Blumen.",
    body: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Guten Tag ${escapeHtml(name)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Ihr Konto bei Magenta Blumen ist angelegt. Sie können ab sofort
        bestellen und finden Ihre Bestellungen jederzeit unter «Mein Konto».
      </p>
      <p style="margin:16px 0 12px;font-size:15px;line-height:1.6;">
        Wenn Sie möchten, bestätigen Sie Ihre E-Mail-Adresse — das ist
        freiwillig und dient nur der Passwort-Rücksetzung:
      </p>
      <p style="margin:0 0 20px;">
        <a href="${verifyUrl}" style="display:inline-block;padding:12px 20px;background:#a0185a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.04em;">
          E-Mail bestätigen
        </a>
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#4f6752;">
        Der Link läuft nach 24 Stunden ab. Sie können ihn ignorieren,
        wenn Sie keine Bestätigung wünschen.
      </p>
    `,
  });
  const text = [
    `Willkommen bei Magenta Blumen`,
    ``,
    `Guten Tag ${name},`,
    ``,
    `Ihr Konto bei Magenta Blumen ist angelegt. Sie finden Ihre Bestellungen jederzeit unter «Mein Konto».`,
    ``,
    `Falls Sie Ihre E-Mail-Adresse bestätigen möchten (freiwillig; nötig für Passwort-Rücksetzung):`,
    verifyUrl,
    ``,
    `Der Link läuft in 24 Stunden ab.`,
    ``,
    `Bei Fragen: 056 556 56 09 oder info@magenta-blumen.ch`,
    ``,
    `Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST`,
  ].join("\n");
  return { subject, html, text };
}

export function passwordResetEmail(
  c: AccountEmailCustomer,
  resetUrl: string,
): { subject: string; html: string; text: string } {
  const name = displayName(c);
  const subject = "Passwort zurücksetzen bei Magenta Blumen";
  const html = accountShell({
    heading: "Passwort zurücksetzen.",
    body: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Guten Tag ${escapeHtml(name)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Jemand hat soeben angefordert, Ihr Passwort zurückzusetzen. War
        das nicht Sie, können Sie diese Mail einfach ignorieren.
      </p>
      <p style="margin:16px 0 20px;">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#a0185a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;letter-spacing:0.04em;">
          Neues Passwort setzen
        </a>
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#4f6752;">
        Der Link ist <strong>1 Stunde</strong> gültig und verfällt,
        sobald Ihr Passwort geändert wurde.
      </p>
    `,
  });
  const text = [
    `Magenta Blumen — Passwort zurücksetzen`,
    ``,
    `Guten Tag ${name},`,
    ``,
    `Jemand hat angefordert, Ihr Passwort zurückzusetzen. Ignorieren Sie diese Mail, falls das nicht Sie waren.`,
    ``,
    `Neues Passwort setzen:`,
    resetUrl,
    ``,
    `Der Link ist 1 Stunde gültig.`,
    ``,
    `Bei Fragen: 056 556 56 09 oder info@magenta-blumen.ch`,
    ``,
    `Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST`,
  ].join("\n");
  return { subject, html, text };
}

/**
 * Confirmation after a successful password change — either via the
 * "neues Passwort setzen" link or via /konto/einstellungen. The
 * warning line is the load-bearing part: if the account was taken
 * over, the legitimate owner finds out immediately.
 */
export function passwordChangedEmail(c: AccountEmailCustomer): {
  subject: string;
  html: string;
  text: string;
} {
  const name = displayName(c);
  const subject = "Ihr Passwort wurde geändert";
  const html = accountShell({
    heading: "Passwort geändert.",
    body: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Guten Tag ${escapeHtml(name)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Das Passwort Ihres Magenta-Blumen-Kontos wurde soeben
        geändert. Falls Sie das waren, müssen Sie nichts tun — Sie
        können sich mit dem neuen Passwort anmelden.
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#a0185a;">
        <strong>Waren Sie das nicht?</strong> Rufen Sie uns bitte
        sofort an unter
        <a href="tel:+41565565609" style="color:#a0185a;">056 556 56 09</a>
        — wir sperren den Zugang sofort.
      </p>
    `,
  });
  const text = [
    `Magenta Blumen — Passwort geändert`,
    ``,
    `Guten Tag ${name},`,
    ``,
    `Das Passwort Ihres Magenta-Blumen-Kontos wurde soeben geändert. Falls Sie das waren, können Sie sich mit dem neuen Passwort anmelden.`,
    ``,
    `WAREN SIE DAS NICHT? Rufen Sie uns bitte sofort an: 056 556 56 09 — wir sperren den Zugang.`,
    ``,
    `Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST`,
  ].join("\n");
  return { subject, html, text };
}

/**
 * FADP farewell. Sent to the customer's pre-anonymisation email
 * address immediately after `anonymiseCustomer` commits. Explains
 * what happened and what was retained (orders for 10-year accounting
 * law). Must be sent AFTER commit so a Resend failure doesn't claim
 * deletion that didn't happen.
 */
export function anonymisedEmail(c: AccountEmailCustomer): {
  subject: string;
  html: string;
  text: string;
} {
  const name = displayName(c);
  const subject = "Ihre Kundendaten wurden gelöscht";
  const html = accountShell({
    heading: "Ihre Kundendaten wurden gelöscht.",
    body: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Guten Tag ${escapeHtml(name)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Ihre persönlichen Daten (Name, E-Mail, Telefon, gespeicherte
        Adressen) bei Magenta Blumen wurden auf Ihren Wunsch gelöscht.
        Ein Login mit dem bisherigen Konto ist nicht mehr möglich.
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Aus gesetzlichen Gründen behalten wir frühere Bestellungen und
        die dazugehörigen Rechnungen zehn Jahre lang (Art. 958f OR,
        Aufbewahrungspflicht). Diese Daten dienen ausschliesslich der
        Buchhaltung und werden nicht mehr für Marketing oder Kontakt
        verwendet.
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Diese Bestätigung wird einmalig an diese Adresse geschickt;
        weitere E-Mails erhalten Sie von uns nicht mehr. Bei Fragen
        rufen Sie uns bitte unter
        <a href="tel:+41565565609" style="color:#a0185a;">056 556 56 09</a>
        an.
      </p>
    `,
  });
  const text = [
    `Magenta Blumen — Ihre Kundendaten wurden gelöscht`,
    ``,
    `Guten Tag ${name},`,
    ``,
    `Ihre persönlichen Daten (Name, E-Mail, Telefon, gespeicherte Adressen) bei Magenta Blumen wurden auf Ihren Wunsch gelöscht. Ein Login mit dem bisherigen Konto ist nicht mehr möglich.`,
    ``,
    `Aus gesetzlichen Gründen (Art. 958f OR) behalten wir frühere Bestellungen und die dazugehörigen Rechnungen zehn Jahre lang. Diese Daten dienen ausschliesslich der Buchhaltung.`,
    ``,
    `Diese Bestätigung wird einmalig geschickt; weitere E-Mails erhalten Sie von uns nicht mehr.`,
    ``,
    `Bei Fragen: 056 556 56 09`,
    ``,
    `Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST`,
  ].join("\n");
  return { subject, html, text };
}

// ------------------------------------------------------------------
// Payment-failed — card / TWINT declined
// ------------------------------------------------------------------

export type PaymentFailedEmailData = {
  orderNumber: string;
  buyerName: string;
  totalGross: string;
  paymentMethod: "card" | "twint";
};

export function paymentFailedEmail(
  d: PaymentFailedEmailData,
): { subject: string; html: string; text: string } {
  const subject = `Zahlung fehlgeschlagen für ${d.orderNumber}`;
  const methodLabel = d.paymentMethod === "twint" ? "TWINT" : "Kreditkarte";
  const html = accountShell({
    heading: "Die Zahlung ist nicht durchgegangen.",
    body: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Guten Tag ${escapeHtml(d.buyerName)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Für Ihre Bestellung <strong>${escapeHtml(d.orderNumber)}</strong>
        (${formatChfInline(d.totalGross)}) wurde die Zahlung per
        ${methodLabel} von Ihrer Bank abgelehnt.
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Die Bestellung wird in Kürze automatisch freigegeben. Falls Sie
        die Blumen nach wie vor möchten, bestellen Sie bitte neu —
        oder rufen Sie uns an, wir reservieren Ihnen den Termin
        telefonisch.
      </p>
    `,
  });
  const text = [
    `Magenta Blumen — Zahlung fehlgeschlagen`,
    ``,
    `Guten Tag ${d.buyerName},`,
    ``,
    `Für Ihre Bestellung ${d.orderNumber} (${formatChfInline(d.totalGross)}) wurde die Zahlung per ${methodLabel} abgelehnt.`,
    ``,
    `Die Bestellung wird in Kürze automatisch freigegeben. Bei Fragen rufen Sie bitte an: 056 556 56 09.`,
    ``,
    `Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST`,
  ].join("\n");
  return { subject, html, text };
}

// ------------------------------------------------------------------
// Contact form — shop inbox + buyer auto-ack
// ------------------------------------------------------------------

export type ContactFormInput = {
  name: string;
  email: string;
  phone: string | null;
  message: string;
};

export function contactFormShopEmail(i: ContactFormInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `[Kontakt] Nachricht von ${i.name}`;
  const html = accountShell({
    heading: "Neue Kontakt-Nachricht",
    body: `
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr><td style="padding:4px 0;color:#4f6752;width:80px;">Name</td><td style="padding:4px 0;"><strong>${escapeHtml(i.name)}</strong></td></tr>
        <tr><td style="padding:4px 0;color:#4f6752;">E-Mail</td><td style="padding:4px 0;"><a href="mailto:${escapeHtml(i.email)}" style="color:#a0185a;">${escapeHtml(i.email)}</a></td></tr>
        ${
          i.phone
            ? `<tr><td style="padding:4px 0;color:#4f6752;">Telefon</td><td style="padding:4px 0;"><a href="tel:${escapeHtml(i.phone)}" style="color:#2a1f1a;">${escapeHtml(i.phone)}</a></td></tr>`
            : ""
        }
      </table>
      <h2 style="font-family:Cormorant,Georgia,serif;font-size:16px;font-weight:400;margin:16px 0 4px;color:#2a1f1a;">Nachricht</h2>
      <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(i.message)}</p>
    `,
  });
  const text = [
    `Neue Kontakt-Nachricht`,
    ``,
    `Name:    ${i.name}`,
    `E-Mail:  ${i.email}`,
    i.phone ? `Telefon: ${i.phone}` : "",
    ``,
    `Nachricht:`,
    i.message,
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, html, text };
}

export function contactFormAckEmail(i: ContactFormInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Wir haben Ihre Nachricht erhalten";
  const html = accountShell({
    heading: "Danke für Ihre Nachricht.",
    body: `
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Guten Tag ${escapeHtml(i.name)},
      </p>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">
        Wir haben Ihre Nachricht erhalten und melden uns in der Regel
        innerhalb eines Werktags. Dringende Anliegen klären wir am
        schnellsten am Telefon unter
        <a href="tel:+41565565609" style="color:#a0185a;">056 556 56 09</a>.
      </p>
      <h2 style="font-family:Cormorant,Georgia,serif;font-size:16px;font-weight:400;margin:16px 0 4px;color:#2a1f1a;">Ihre Nachricht</h2>
      <p style="margin:0;font-size:14px;line-height:1.6;color:#4f6752;white-space:pre-wrap;">${escapeHtml(i.message)}</p>
    `,
  });
  const text = [
    `Magenta Blumen — Nachricht erhalten`,
    ``,
    `Guten Tag ${i.name},`,
    ``,
    `Wir haben Ihre Nachricht erhalten und melden uns in der Regel innerhalb eines Werktags. Dringend: 056 556 56 09.`,
    ``,
    `Ihre Nachricht:`,
    i.message,
    ``,
    `Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST`,
  ].join("\n");
  return { subject, html, text };
}

// Shared visual shell for account-lifecycle + contact emails. Keeps the
// buyer-confirmation layout intact for Art. 26 MWSTG compliance; this
// one is for everything that is NOT an invoice.
function accountShell(opts: { heading: string; body: string }): string {
  return `
<!doctype html>
<html lang="de-CH">
  <body style="margin:0;padding:0;background:#fdfcf9;font-family:'DM Sans',system-ui,sans-serif;color:#2a1f1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #ede9e3;">
          <tr><td style="padding:24px 32px 8px;">
            <div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#4f6752;">
              Magenta Blumen
            </div>
          </td></tr>
          <tr><td style="padding:8px 32px 24px;">
            <h1 style="font-family:Cormorant,Georgia,serif;font-size:26px;font-weight:400;color:#2a1f1a;margin:0 0 16px;">
              ${escapeHtml(opts.heading)}
            </h1>
            ${opts.body}
          </td></tr>
          <tr><td style="padding:16px 32px;border-top:1px solid #ede9e3;color:#4f6752;font-size:11px;letter-spacing:0.08em;">
            Magenta Blumen - Kishta · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim();
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

export function slotLabelDe(o: OrderEmailData): string {
  if (o.fulfilment === "timed" && o.requestedDeliveryAt) {
    const dt = DateTime.fromJSDate(o.requestedDeliveryAt, {
      zone: "Europe/Zurich",
    }).setLocale("de-CH");
    return `${dt.toFormat("cccc d. LLLL")} . ${dt.toFormat("HH:mm")} Uhr (Zeremonie)`;
  }
  if (o.deliveryDate && o.sortTime) {
    const d = DateTime.fromISO(o.deliveryDate, {
      zone: "Europe/Zurich",
    }).setLocale("de-CH");
    const window =
      o.sortTime.startsWith("10")
        ? "10:00-12:00"
        : o.sortTime.startsWith("16")
          ? "16:00-18:00"
          : o.sortTime.slice(0, 5);
    return `${d.toFormat("cccc d. LLLL")} . ${window}`;
  }
  return "Termin nicht gesetzt";
}

export function slotLabelShortDe(o: OrderEmailData): string {
  if (o.fulfilment === "timed" && o.requestedDeliveryAt) {
    const dt = DateTime.fromJSDate(o.requestedDeliveryAt, {
      zone: "Europe/Zurich",
    }).setLocale("de-CH");
    return dt.toFormat("ccc d. LLL HH:mm");
  }
  if (o.deliveryDate && o.sortTime) {
    const d = DateTime.fromISO(o.deliveryDate, {
      zone: "Europe/Zurich",
    }).setLocale("de-CH");
    const window = o.sortTime.startsWith("10") ? "Vorm" : "Nachm";
    return `${d.toFormat("ccc d. LLL")} ${window}`;
  }
  return "ohne Termin";
}

export function paymentMethodLabelDe(m: OrderEmailData["paymentMethod"]): string {
  switch (m) {
    case "card":
      return "Kreditkarte (bezahlt)";
    case "twint":
      return "TWINT (bezahlt)";
    case "cash":
      return "Barzahlung bei Abholung oder Lieferung";
    case "invoice":
      return "Rechnung (Zahlungsziel 30 Tage)";
  }
}

export function deliveryContextLabelDe(
  dc: OrderEmailData["deliveryContext"],
): string {
  switch (dc) {
    case "residential":
      return "Privatadresse";
    case "business":
      return "Firma / Büro";
    case "hospital":
      return "Spital";
    case "funeral":
      return "Trauerort";
  }
}

export function formatChfInline(s: string | number): string {
  const n = typeof s === "string" ? Number(s) : s;
  if (!Number.isFinite(n)) return String(s);
  return `CHF ${n.toFixed(2)}`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
