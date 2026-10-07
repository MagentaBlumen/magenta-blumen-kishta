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
  totalGross: string;
  paymentMethod: "cash" | "invoice" | "card" | "twint";
  lines: OrderEmailLine[];
};

// ------------------------------------------------------------------
// Buyer confirmation
// ------------------------------------------------------------------

export function buyerConfirmationEmail(o: OrderEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Ihre Bestellung ${o.orderNumber} bei Magenta Blumen`;

  const deliveryLabel = slotLabelDe(o);
  const paymentLabel = paymentMethodLabelDe(o.paymentMethod);

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
                Bei Fragen erreichen Sie uns unter <a href="tel:+41565565609" style="color:#a0185a;">056 556 56 09</a>
                oder <a href="mailto:info@magenta-blumen.ch" style="color:#a0185a;">info@magenta-blumen.ch</a>.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #ede9e3;color:#4f6752;font-size:11px;letter-spacing:0.08em;">
              Magenta Blumen · Zürcherstrasse 142 · 5432 Neuenhof · CHE-363.951.581 MWST
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
    ``,
    `Zahlung: ${paymentLabel}`,
    o.cardMessage
      ? `\nKarte: «${o.cardMessage}»${o.cardIsAnonymous ? " (anonym)" : ""}`
      : ``,
    ``,
    `Bei Fragen: 056 556 56 09 oder info@magenta-blumen.ch`,
    ``,
    `Magenta Blumen - Zürcherstrasse 142 - 5432 Neuenhof - CHE-363.951.581 MWST`,
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
