/**
 * Email template tests. Pure functions - no DB, no Resend SDK, no
 * network. Just assert that for a given OrderEmailData the resulting
 * subject / html / text contain what we need and omit what we must not.
 */

import { describe, expect, it } from "vitest";
import {
  anonymisedEmail,
  buyerConfirmationEmail as rawBuyerConfirmationEmail,
  buyerStatusEmail as rawBuyerStatusEmail,
  computeVatBreakdown,
  contactFormAckEmail,
  contactFormShopEmail,
  escapeHtml,
  formatChfInline,
  passwordChangedEmail,
  passwordResetEmail,
  paymentFailedEmail,
  paymentMethodLabelDe,
  shopNotificationEmail,
  slotLabelDe,
  welcomeVerifyEmail,
  type OrderEmailData,
  type StatusEmailKind,
} from "@/lib/email/templates";

const TEST_DEEP_LINK_FIXTURE =
  "https://example.ch/bestellung-finden/zugang/abc.111.deadbeef";

// Thin wrappers that inject the deep-link URL for every call site so
// existing tests keep their old two-arg / one-arg shape.
function buyerConfirmationEmail(order: OrderEmailData) {
  return rawBuyerConfirmationEmail(order, TEST_DEEP_LINK_FIXTURE);
}
function buyerStatusEmail(order: OrderEmailData, kind: StatusEmailKind) {
  return rawBuyerStatusEmail(order, kind, TEST_DEEP_LINK_FIXTURE);
}

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
    deliveryFeeTaxRate: "0.0260",
    totalGross: "58.00",
    paymentMethod: "card",
    lines: [
      {
        productNameDe: "Grosse Rosen",
        variantLabelDe: "Mittel",
        quantity: 1,
        unitPriceGross: "50.00",
        lineTotalGross: "50.00",
        taxRate: "0.0260",
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

  it("splits the MWST block by rate when an order mixes 2.6% and 8.1%", () => {
    // Bouquet CHF 50.00 at 2.6% + vase CHF 30.00 at 8.1% + delivery
    // CHF 8.00 at 2.6% (ancillary to the main 2.6% supply, interim rule
    // from docs/vat-rates.md). Total CHF 88.00.
    //
    // Expected included MWST per rate:
    //   2.6%: gross 58.00 → VAT 58 * 0.026 / 1.026 = 1.47 → net 56.53
    //   8.1%: gross 30.00 → VAT 30 * 0.081 / 1.081 = 2.25 → net 27.75
    const r = buyerConfirmationEmail(
      baseOrder({
        subtotalGross: "80.00",
        deliveryFeeGross: "8.00",
        deliveryFeeTaxRate: "0.0260",
        totalGross: "88.00",
        lines: [
          {
            productNameDe: "Rosenstrauss",
            variantLabelDe: "Gross",
            quantity: 1,
            unitPriceGross: "50.00",
            lineTotalGross: "50.00",
            taxRate: "0.0260",
          },
          {
            productNameDe: "Keramik-Vase",
            variantLabelDe: null,
            quantity: 1,
            unitPriceGross: "30.00",
            lineTotalGross: "30.00",
            taxRate: "0.0810",
          },
        ],
      }),
    );

    expect(r.html).toContain("MWST-Aufschlüsselung");
    expect(r.html).toContain("MWST 2.6%");
    expect(r.html).toContain("MWST 8.1%");
    expect(r.html).toContain("CHF 1.47");
    expect(r.html).toContain("CHF 56.53");
    expect(r.html).toContain("CHF 2.25");
    expect(r.html).toContain("CHF 27.75");

    expect(r.text).toContain("MWST-Aufschlüsselung");
    expect(r.text).toContain("2.6%:");
    expect(r.text).toContain("8.1%:");
    expect(r.text).toContain("CHF 1.47");
    expect(r.text).toContain("CHF 2.25");
  });

  it("omits the MWST block entirely when no line carries a tax rate", () => {
    const r = buyerConfirmationEmail(
      baseOrder({
        deliveryFeeTaxRate: null,
        lines: [
          {
            productNameDe: "Rosenstrauss",
            variantLabelDe: "Gross",
            quantity: 1,
            unitPriceGross: "50.00",
            lineTotalGross: "50.00",
            taxRate: null,
          },
        ],
      }),
    );
    expect(r.html).not.toContain("MWST-Aufschlüsselung");
    expect(r.text).not.toContain("MWST-Aufschlüsselung");
  });

  it("renders the signed deep-link URL so Task 3's dead /bestellung-finden URL is gone", () => {
    const r = buyerConfirmationEmail(baseOrder());
    // Deep-link URL must appear in both HTML and text; the old
    // /bestellung-finden (no token) URL must not.
    expect(r.html).toContain(TEST_DEEP_LINK_FIXTURE);
    expect(r.text).toContain(TEST_DEEP_LINK_FIXTURE);
    expect(r.html).not.toMatch(/\/bestellung-finden"/);
    expect(r.text).not.toMatch(/\/bestellung-finden\s/);
    expect(r.html).toContain("Bestellung öffnen");
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

describe("account lifecycle emails", () => {
  it("welcomeVerifyEmail embeds the verification URL in both HTML and text", () => {
    const r = welcomeVerifyEmail(
      { firstName: "Anna", lastName: "Muster", email: "anna@example.ch" },
      "https://example.ch/konto/email-bestaetigen/abc.def.ghi",
    );
    expect(r.subject).toContain("Willkommen");
    expect(r.html).toContain("Anna Muster");
    expect(r.html).toContain(
      "https://example.ch/konto/email-bestaetigen/abc.def.ghi",
    );
    expect(r.text).toContain("Anna Muster");
    expect(r.text).toContain(
      "https://example.ch/konto/email-bestaetigen/abc.def.ghi",
    );
    // Verification is voluntary — the copy must say so.
    expect(r.html.toLowerCase()).toContain("freiwillig");
  });

  it("welcomeVerifyEmail falls back to the email local part when name is missing", () => {
    const r = welcomeVerifyEmail(
      { firstName: null, lastName: null, email: "someone@example.ch" },
      "https://example.ch/konto/email-bestaetigen/xxx.yyy.zzz",
    );
    expect(r.html).toContain("Guten Tag someone");
  });

  it("passwordResetEmail embeds the reset URL and states the 1 h TTL", () => {
    const r = passwordResetEmail(
      { firstName: "Hans", lastName: "Muster", email: "h@example.ch" },
      "https://example.ch/konto/passwort-zuruecksetzen/42.111.aa.bb",
    );
    expect(r.subject).toMatch(/Passwort/);
    expect(r.html).toContain(
      "https://example.ch/konto/passwort-zuruecksetzen/42.111.aa.bb",
    );
    expect(r.html).toContain("1 Stunde");
    expect(r.text).toContain(
      "https://example.ch/konto/passwort-zuruecksetzen/42.111.aa.bb",
    );
  });

  it("paymentFailedEmail names the order and the method", () => {
    const r = paymentFailedEmail({
      orderNumber: "MB-20261125-DEADBEEF",
      buyerName: "Max Muster",
      totalGross: "78.50",
      paymentMethod: "twint",
    });
    expect(r.subject).toContain("MB-20261125-DEADBEEF");
    expect(r.html).toContain("Max Muster");
    expect(r.html).toContain("CHF 78.50");
    expect(r.html).toContain("TWINT");
    expect(r.text).toContain("TWINT");
  });

  it("paymentFailedEmail uses 'Kreditkarte' for the card branch", () => {
    const r = paymentFailedEmail({
      orderNumber: "MB-X",
      buyerName: "A",
      totalGross: "10.00",
      paymentMethod: "card",
    });
    expect(r.html).toContain("Kreditkarte");
    expect(r.html).not.toContain("TWINT");
  });

  it("passwordChangedEmail warns about unauthorised changes with the shop phone number", () => {
    const r = passwordChangedEmail({
      firstName: "Max",
      lastName: "Muster",
      email: "max@example.ch",
    });
    expect(r.subject.toLowerCase()).toContain("passwort");
    expect(r.html).toContain("Max Muster");
    // Load-bearing "if this wasn't you, call us" copy + shop phone.
    expect(r.html.toLowerCase()).toContain("waren sie das nicht");
    expect(r.html).toContain("056 556 56 09");
    expect(r.text.toLowerCase()).toContain("waren sie das nicht");
  });

  it("anonymisedEmail names the retention law + skips marketing promises", () => {
    const r = anonymisedEmail({
      firstName: "Anna",
      lastName: "Muster",
      email: "anna@example.ch",
    });
    expect(r.subject.toLowerCase()).toContain("gelöscht");
    expect(r.html).toContain("Anna Muster");
    // OR 958f is the ten-year retention under Swiss accounting law —
    // naming it means the receiver sees exactly WHY orders are kept.
    expect(r.html).toContain("958f");
    expect(r.html.toLowerCase()).toContain("zehn jahre");
    // Shop phone, no replyTo hint.
    expect(r.html).toContain("056 556 56 09");
    expect(r.text).toContain("958f");
  });
});

describe("buyerStatusEmail: storniert", () => {
  it("renders the cancellation subject + refund mention", () => {
    const r = buyerStatusEmail(
      {
        orderNumber: "MB-20261125-DEADBEEF",
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
        deliveryDate: "2026-11-25",
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
        deliveryFeeTaxRate: "0.0260",
        totalGross: "58.00",
        paymentMethod: "card",
        lines: [],
      },
      "storniert",
    );
    expect(r.subject).toContain("MB-20261125-DEADBEEF");
    expect(r.subject.toLowerCase()).toContain("storniert");
    expect(r.html).toContain("Max Muster");
    expect(r.html.toLowerCase()).toContain("erstatten"); // refund mention
    expect(r.text.toLowerCase()).toContain("storniert");
  });
});

describe("contact form emails", () => {
  const input = {
    name: "Anna Muster",
    email: "anna@example.ch",
    phone: "+41 79 000 00 00",
    message: "Guten Tag,\n\nich möchte eine Hochzeit besprechen.",
  };

  it("shop email includes sender details and message", () => {
    const r = contactFormShopEmail(input);
    expect(r.subject).toContain("Anna Muster");
    expect(r.html).toContain("Anna Muster");
    expect(r.html).toContain("anna@example.ch");
    expect(r.html).toContain("+41 79 000 00 00");
    expect(r.html).toContain("Hochzeit besprechen");
    expect(r.text).toContain("Anna Muster");
    expect(r.text).toContain("Hochzeit besprechen");
  });

  it("shop email handles the phone-missing branch", () => {
    const r = contactFormShopEmail({ ...input, phone: null });
    expect(r.html).not.toContain("+41");
    expect(r.text).not.toContain("Telefon:");
  });

  it("ack email thanks the sender and quotes the message back", () => {
    const r = contactFormAckEmail(input);
    expect(r.subject.toLowerCase()).toContain("nachricht");
    expect(r.html).toContain("Anna Muster");
    expect(r.html).toContain("Hochzeit besprechen");
    expect(r.html).toContain("056 556 56 09");
    expect(r.text).toContain("Hochzeit besprechen");
  });

  it("escapes HTML in user-supplied contact-form fields", () => {
    const r = contactFormShopEmail({
      name: "<script>x</script>",
      email: "x@y.z",
      phone: null,
      message: "<img onerror=alert(1)>",
    });
    expect(r.html).not.toContain("<script>x</script>");
    expect(r.html).not.toContain("<img onerror");
    expect(r.html).toContain("&lt;script&gt;");
  });
});

describe("computeVatBreakdown", () => {
  it("groups a single-rate order into one row", () => {
    const rows = computeVatBreakdown(
      [
        {
          productNameDe: "x",
          variantLabelDe: null,
          quantity: 1,
          unitPriceGross: "50.00",
          lineTotalGross: "50.00",
          taxRate: "0.0260",
        },
      ],
      "0.00",
      null,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ratePct).toBe("2.6");
    expect(rows[0].grossAmount).toBe("50.00");
    // 50 * 0.026 / 1.026 = 1.267... → 1.27
    expect(rows[0].vatAmount).toBe("1.27");
    expect(rows[0].netAmount).toBe("48.73");
  });

  it("computeVatBreakdown emits two rows for a mixed-rate order and sums delivery into its own rate", () => {
    const rows = computeVatBreakdown(
      [
        {
          productNameDe: "Strauss",
          variantLabelDe: null,
          quantity: 1,
          unitPriceGross: "50.00",
          lineTotalGross: "50.00",
          taxRate: "0.0260",
        },
        {
          productNameDe: "Vase",
          variantLabelDe: null,
          quantity: 1,
          unitPriceGross: "30.00",
          lineTotalGross: "30.00",
          taxRate: "0.0810",
        },
      ],
      "8.00",
      "0.0260",
    );
    expect(rows).toHaveLength(2);
    const r26 = rows.find((r) => r.rate === "0.0260")!;
    const r81 = rows.find((r) => r.rate === "0.0810")!;
    // 2.6%: 50 + 8 = 58 gross. VAT 58*0.026/1.026 = 1.470... → 1.47
    expect(r26.grossAmount).toBe("58.00");
    expect(r26.vatAmount).toBe("1.47");
    expect(r26.netAmount).toBe("56.53");
    // 8.1%: 30 gross. VAT 30*0.081/1.081 = 2.248... → 2.25
    expect(r81.grossAmount).toBe("30.00");
    expect(r81.vatAmount).toBe("2.25");
    expect(r81.netAmount).toBe("27.75");
  });
});
