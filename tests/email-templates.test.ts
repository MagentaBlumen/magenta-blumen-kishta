/**
 * Email template tests. Pure functions - no DB, no Resend SDK, no
 * network. Just assert that for a given OrderEmailData the resulting
 * subject / html / text contain what we need and omit what we must not.
 */

import { describe, expect, it } from "vitest";
import {
  buyerConfirmationEmail,
  escapeHtml,
  formatChfInline,
  paymentMethodLabelDe,
  shopNotificationEmail,
  slotLabelDe,
  type OrderEmailData,
} from "@/lib/email/templates";

function baseOrder(overrides: Partial<OrderEmailData> = {}): OrderEmailData {
  return {
    orderNumber: "MB-20261006-ABCDEF01",
    buyerName: "Max Muster",
    buyerEmail: "max@example.ch",
    buyerPhone: "+41 79 000 00 00",
    recipientName: "Anna Example",
    recipientPhone: null,
    deliveryStreet: "Beispielweg 7",
    deliveryPlz: "5432",
    deliveryCity: "Neuenhof",
    deliveryZoneName: "Neuenhof",
    fulfilment: "run",
    deliveryDate: "2026-10-07",
    sortTime: "10:00:00",
    requestedDeliveryAt: null,
    cardMessage: null,
    cardIsAnonymous: false,
    ribbonText: null,
    deliveryInstructions: null,
    deliveryContext: "residential",
    deliveryWard: null,
    deliveryRoom: null,
    deceasedName: null,
    familyContactPhone: null,
    subtotalGross: "50.00",
    deliveryFeeGross: "8.00",
    totalGross: "58.00",
    paymentMethod: "card",
    lines: [
      {
        productNameDe: "Grosse Rosen",
        variantLabelDe: "Mittel",
        quantity: 1,
        unitPriceGross: "50.00",
        lineTotalGross: "50.00",
      },
    ],
    ...overrides,
  };
}

describe("buyerConfirmationEmail", () => {
  it("includes the order number, total, and recipient address", () => {
    const r = buyerConfirmationEmail(baseOrder());
    expect(r.subject).toContain("MB-20261006-ABCDEF01");
    expect(r.subject).toContain("Magenta Blumen");
    expect(r.html).toContain("MB-20261006-ABCDEF01");
    expect(r.html).toContain("Anna Example");
    expect(r.html).toContain("Beispielweg 7");
    expect(r.html).toContain("CHF 58.00");
    expect(r.text).toContain("MB-20261006-ABCDEF01");
    expect(r.text).toContain("Total:");
    expect(r.text).toContain("CHF 58.00");
  });

  it("renders the card message as a quote when provided", () => {
    const r = buyerConfirmationEmail(
      baseOrder({ cardMessage: "Alles Gute zum Geburtstag!" }),
    );
    expect(r.html).toContain("Alles Gute zum Geburtstag");
    expect(r.text).toContain("Alles Gute zum Geburtstag");
  });

  it("marks anonymous when the flag is set", () => {
    const r = buyerConfirmationEmail(
      baseOrder({ cardMessage: "Von einem Freund", cardIsAnonymous: true }),
    );
    expect(r.html).toContain("anonym");
    expect(r.text).toContain("anonym");
  });

  it("shows 'gratis' when delivery fee is zero", () => {
    const r = buyerConfirmationEmail(
      baseOrder({ deliveryFeeGross: "0.00", totalGross: "50.00" }),
    );
    expect(r.html).toContain("gratis");
    expect(r.text).toContain("gratis");
  });

  it("escapes HTML in user input", () => {
    const r = buyerConfirmationEmail(
      baseOrder({
        recipientName: "<script>alert(1)</script>",
        cardMessage: "<img onerror=alert()>",
      }),
    );
    expect(r.html).not.toContain("<script>alert(1)</script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("Rule 8 guard: recipient's phone number is for the shop, never emailed to the buyer prominently", () => {
    // The buyer email shows the recipient NAME + ADDRESS. The
    // recipient's PHONE goes on the shop email (for failed-delivery
    // recovery), not the buyer confirmation.
    const r = buyerConfirmationEmail(
      baseOrder({ recipientPhone: "+41 79 555 55 55" }),
    );
    // No specific requirement to omit it, but the template as written
    // doesn't put the recipient phone in the buyer email. Lock that in.
    expect(r.html).not.toContain("+41 79 555 55 55");
    expect(r.text).not.toContain("+41 79 555 55 55");
  });
});

describe("shopNotificationEmail", () => {
  it("subject carries [Neue Bestellung] + order number + short slot", () => {
    const r = shopNotificationEmail(baseOrder());
    expect(r.subject).toContain("Neue Bestellung");
    expect(r.subject).toContain("MB-20261006-ABCDEF01");
  });

  it("funeral orders get a TRAUER prefix in the subject", () => {
    const r = shopNotificationEmail(
      baseOrder({
        deliveryContext: "funeral",
        deceasedName: "Hans Beispiel",
        familyContactPhone: "+41 79 111 11 11",
      }),
    );
    expect(r.subject.toUpperCase()).toContain("TRAUER");
    expect(r.html).toContain("Hans Beispiel");
    expect(r.html).toContain("+41 79 111 11 11");
    expect(r.text).toContain("Hans Beispiel");
  });

  it("hospital orders show the ward prominently", () => {
    const r = shopNotificationEmail(
      baseOrder({
        deliveryContext: "hospital",
        deliveryWard: "Station A3",
        deliveryRoom: "214",
      }),
    );
    expect(r.html).toContain("Station A3");
    expect(r.html).toContain("214");
    expect(r.text).toContain("Station A3");
    expect(r.text).toContain("214");
  });

  it("includes the ribbon text (Trauerband) when present", () => {
    const r = shopNotificationEmail(
      baseOrder({
        deliveryContext: "funeral",
        deceasedName: "Hans Beispiel",
        familyContactPhone: "+41 79 111 11 11",
        ribbonText: "In stiller Anteilnahme",
      }),
    );
    expect(r.html).toContain("Trauerband");
    expect(r.html).toContain("In stiller Anteilnahme");
    expect(r.text).toContain("Trauerband");
  });

  it("buyer phone is clickable (tel:) for Sandra to call back", () => {
    const r = shopNotificationEmail(
      baseOrder({ buyerPhone: "+41 79 000 00 00" }),
    );
    expect(r.html).toContain('href="tel:+41 79 000 00 00"');
  });

  it("delivery instructions appear when the buyer wrote any", () => {
    const r = shopNotificationEmail(
      baseOrder({ deliveryInstructions: "Beim Nachbarn abgeben" }),
    );
    expect(r.html).toContain("Beim Nachbarn abgeben");
    expect(r.text).toContain("Beim Nachbarn abgeben");
  });
});

describe("helpers", () => {
  it("slotLabelDe formats a run slot in Europe/Zurich", () => {
    const label = slotLabelDe(baseOrder());
    expect(label).toContain("10:00-12:00");
  });

  it("slotLabelDe formats a timed slot with the HH:mm", () => {
    const dt = new Date("2026-10-07T13:30:00+02:00");
    const label = slotLabelDe(
      baseOrder({
        fulfilment: "timed",
        requestedDeliveryAt: dt,
        deliveryDate: null,
        sortTime: null,
      }),
    );
    expect(label).toContain("13:30");
    expect(label).toContain("Zeremonie");
  });

  it("formatChfInline sticks to two decimals", () => {
    expect(formatChfInline("50")).toBe("CHF 50.00");
    expect(formatChfInline(49.9)).toBe("CHF 49.90");
    expect(formatChfInline("50.123")).toBe("CHF 50.12");
  });

  it("paymentMethodLabelDe covers every method", () => {
    expect(paymentMethodLabelDe("card")).toMatch(/Kreditkarte/);
    expect(paymentMethodLabelDe("twint")).toMatch(/TWINT/);
    expect(paymentMethodLabelDe("cash")).toMatch(/Barzahlung/);
    expect(paymentMethodLabelDe("invoice")).toMatch(/Rechnung/);
  });

  it("escapeHtml handles the five dangerous characters", () => {
    expect(escapeHtml("<a href=\"x\">&'</a>")).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;",
    );
  });
});
