// Not 'server-only' - the concurrency test in tests/ imports reserveOrder
// with two separate DB clients. Every caller in application code goes
// through actions.ts which IS server-only, so we still can't reach this
// from the client bundle in practice.
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db as defaultDb } from "@/db/client";
import { product, productVariant } from "@/db/schema/catalogue";
import { deliveryRun, deliveryZone, deliveryZonePlz } from "@/db/schema/delivery";
import { order, orderLine } from "@/db/schema/order";
import { payment } from "@/db/schema/payment";
import { settings, taxRate as taxRateTable } from "@/db/schema/settings";
import type { CartCookie } from "@/lib/cart/types";
import type { CheckoutCookie, DeliveryContextCookie } from "./types";
import { generateOrderNumber } from "./order-number";
import { chfToRappen, requireStripe } from "./stripe";
import { resolveDeliveryTaxRate } from "./tax";
import { ZONE } from "./time";

/** Drizzle-postgres client. Kept loose so the concurrency test can
 *  pass in a client backed by its own single-connection pool. */
type DbClient = typeof defaultDb;

/**
 * Phase A of the reserve-then-charge flow. See docs/checkout-transaction.md.
 *
 * Every read + write happens inside one db.transaction. The `FOR UPDATE`
 * lock on the run row is the whole point - without it, two customers
 * booking the last slot simultaneously both read count = 19, both
 * compare against capacity = 20, both insert. Passes every manual
 * test, fails once a year.
 *
 * The inner `reserveOrder` takes fully-composed inputs (no cookie
 * reads) so the concurrency test can drive it with synthesised state
 * on two separate DB connections.
 */

// ------------------------------------------------------------------
// Public shapes
// ------------------------------------------------------------------

export type ReservePaymentMethod = "cash" | "invoice" | "card" | "twint";

export type ReserveInput = {
  cart: CartCookie;
  checkout: CheckoutCookie;
  paymentMethod: ReservePaymentMethod;
};

export type ReserveResult = {
  orderId: number;
  orderNumber: string;
  totalGross: string;      // numeric string
  amountDueGross: string;  // numeric string
  /**
   * Set for card/twint reservations. The Payment Element on the client
   * uses this to confirm the payment against Stripe. Absent for
   * cash/invoice (no Stripe intent) and for zero-due orders.
   */
  clientSecret?: string;
};

/**
 * Thrown on any recoverable business failure - customer should get a
 * German error message, the transaction is rolled back automatically,
 * no order or payment row exists.
 */
export class ReserveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReserveError";
  }
}

// ------------------------------------------------------------------
// The transaction
// ------------------------------------------------------------------

export async function reserveOrder(
  input: ReserveInput,
  dbClient: DbClient = defaultDb,
): Promise<ReserveResult> {
  const { cart, checkout, paymentMethod } = input;

  if (cart.l.length === 0) throw new ReserveError("Der Warenkorb ist leer.");

  // Sanity-check step 1+2 completion up front so we don't run half a
  // transaction. Everything gets re-validated inside the tx too - this
  // just gives better error messages when the cookie is broken.
  if (!checkout.plz || !checkout.ort || !checkout.zid) {
    throw new ReserveError("Bitte wählen Sie zuerst eine Lieferadresse.");
  }
  if (checkout.ful !== "run" && checkout.ful !== "timed") {
    throw new ReserveError("Bitte wählen Sie eine Liefermethode.");
  }
  if (checkout.ful === "run" && !checkout.rid) {
    throw new ReserveError("Bitte wählen Sie einen Liefertermin.");
  }
  if (checkout.ful === "timed" && !checkout.rda) {
    throw new ReserveError("Bitte wählen Sie einen Zeitpunkt.");
  }
  if (!checkout.bn || !checkout.be || !checkout.bp) {
    throw new ReserveError("Bitte füllen Sie Ihre Kontaktdaten aus.");
  }
  if (!checkout.rn || !checkout.st) {
    throw new ReserveError("Bitte geben Sie Empfänger und Adresse an.");
  }
  const dc: DeliveryContextCookie = checkout.dc ?? "residential";
  if (dc === "hospital" && !checkout.dw) {
    throw new ReserveError("Bitte geben Sie die Abteilung an.");
  }
  if (dc === "funeral" && (!checkout.dn || !checkout.fc)) {
    throw new ReserveError(
      "Bitte geben Sie den Namen der verstorbenen Person und den Familienkontakt an.",
    );
  }
  if (
    paymentMethod !== "cash" &&
    paymentMethod !== "invoice" &&
    paymentMethod !== "card" &&
    paymentMethod !== "twint"
  ) {
    throw new ReserveError("Ungültige Zahlungsart.");
  }

  // Extract required fields into locals so TypeScript narrowing
  // survives into the transaction closure below.
  const plz = checkout.plz;
  const ort = checkout.ort;
  const buyerName = checkout.bn;
  const buyerEmail = checkout.be;
  const buyerPhone = checkout.bp;
  const recipientName = checkout.rn;
  const street = checkout.st;

  return dbClient.transaction(async (tx) => {
    // -------- 1. Re-price the cart from the DB --------
    //
    // The cookie is a UX artefact. Everything monetary is derived from
    // live product + variant rows here. If the cookie were trusted for
    // prices, someone could edit it to make a CHF 95 bouquet cost 5.
    const productIds = Array.from(new Set(cart.l.map((l) => l.p)));
    const variantIds = Array.from(new Set(cart.l.map((l) => l.v)));

    const [products, variants] = await Promise.all([
      tx
        .select({
          id: product.id,
          nameDe: product.nameDe,
          isAvailable: product.isAvailable,
          isArchived: product.isArchived,
          isOnlineOrderable: product.isOnlineOrderable,
          pricingMode: product.pricingMode,
          taxRateId: product.taxRateId,
        })
        .from(product)
        .where(inArray(product.id, productIds)),
      tx
        .select({
          id: productVariant.id,
          productId: productVariant.productId,
          sizeLabelDe: productVariant.sizeLabelDe,
          priceGross: productVariant.priceGross,
          salePriceGross: productVariant.salePriceGross,
          isAvailable: productVariant.isAvailable,
        })
        .from(productVariant)
        .where(inArray(productVariant.id, variantIds)),
    ]);

    // Fetch tax rates referenced by these products in one query.
    const taxRateIds = Array.from(
      new Set(
        products
          .map((p) => p.taxRateId)
          .filter((id): id is number => id != null),
      ),
    );
    const taxRates = taxRateIds.length
      ? await tx
          .select({ id: taxRateTable.id, rate: taxRateTable.rate })
          .from(taxRateTable)
          .where(inArray(taxRateTable.id, taxRateIds))
      : [];
    const rateById = new Map(taxRates.map((r) => [r.id, r.rate]));

    const productById = new Map(products.map((p) => [p.id, p]));
    const variantById = new Map(variants.map((v) => [v.id, v]));

    // Build the priced-line list.
    type PricedLine = {
      productId: number;
      variantId: number;
      productNameDe: string;
      variantLabelDe: string | null;
      unitPriceGross: number;
      quantity: number;
      lineTotalGrossNum: number;
      taxRate: string | null;
    };
    const pricedLines: PricedLine[] = [];
    for (const cookieLine of cart.l) {
      const p = productById.get(cookieLine.p);
      const v = variantById.get(cookieLine.v);
      if (!p || !v || v.productId !== p.id) {
        throw new ReserveError(
          "Ein Artikel im Warenkorb ist nicht mehr verfügbar. Bitte den Warenkorb überprüfen.",
        );
      }
      if (p.isArchived || !p.isOnlineOrderable) {
        throw new ReserveError(
          `"${p.nameDe}" ist nicht mehr online bestellbar.`,
        );
      }
      if (p.pricingMode === "enquiry") {
        throw new ReserveError(
          `"${p.nameDe}" ist nur auf Anfrage erhältlich.`,
        );
      }
      if (!p.isAvailable || !v.isAvailable) {
        throw new ReserveError(`"${p.nameDe}" ist zurzeit ausverkauft.`);
      }
      const unitPrice = Number(v.salePriceGross ?? v.priceGross);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new ReserveError(
          `Preis für "${p.nameDe}" ist ungültig. Bitte kontaktieren Sie uns.`,
        );
      }
      pricedLines.push({
        productId: p.id,
        variantId: v.id,
        productNameDe: p.nameDe,
        variantLabelDe: v.sizeLabelDe,
        unitPriceGross: unitPrice,
        quantity: cookieLine.q,
        lineTotalGrossNum: round2(unitPrice * cookieLine.q),
        taxRate: p.taxRateId != null ? (rateById.get(p.taxRateId) ?? null) : null,
      });
    }

    const subtotalNum = round2(
      pricedLines.reduce((acc, l) => acc + l.lineTotalGrossNum, 0),
    );

    // -------- 2. Resolve the zone --------
    const [zoneRow] = await tx
      .select({
        zoneId: deliveryZone.id,
        zoneNameDe: deliveryZone.nameDe,
        feeGross: deliveryZone.feeGross,
        minOrderGross: deliveryZone.minOrderGross,
        freeOverGross: deliveryZone.freeOverGross,
        isActive: deliveryZone.isActive,
        ortschaft: deliveryZonePlz.ortschaft,
        plz: deliveryZonePlz.plz,
      })
      .from(deliveryZonePlz)
      .innerJoin(deliveryZone, eq(deliveryZone.id, deliveryZonePlz.zoneId))
      .where(
        and(eq(deliveryZonePlz.plz, plz), eq(deliveryZonePlz.ortschaft, ort)),
      )
      .limit(1);
    if (!zoneRow || !zoneRow.isActive) {
      throw new ReserveError(
        "Wir liefern leider nicht mehr an diese Adresse. Bitte wählen Sie eine andere.",
      );
    }

    // -------- 3. Minimum order (SUBTOTAL, not total) --------
    const minOrderNum = Number(zoneRow.minOrderGross);
    if (subtotalNum < minOrderNum) {
      throw new ReserveError(
        `Der Mindestbestellwert für ${zoneRow.zoneNameDe} liegt bei CHF ${minOrderNum.toFixed(2)}.`,
      );
    }

    // -------- 4. Delivery fee --------
    const zoneFeeNum = Number(zoneRow.feeGross);
    const freeOverNum =
      zoneRow.freeOverGross != null ? Number(zoneRow.freeOverGross) : null;
    const deliveryFeeNum =
      freeOverNum != null && subtotalNum >= freeOverNum
        ? 0
        : zoneFeeNum;

    // Tax rate for the delivery fee. User's correction: this MUST be
    // snapshotted onto order.delivery_fee_tax_rate in the same tx.
    const deliveryFeeTaxRate = resolveDeliveryTaxRate(
      pricedLines.map((l) => ({
        taxRate: l.taxRate,
        lineTotalGross: l.lineTotalGrossNum.toFixed(2),
      })),
    );

    // -------- 5. Totals --------
    const totalNum = round2(subtotalNum + deliveryFeeNum);
    const giftcardAppliedNum = 0; // Phase 3 escape hatch, always 0 for now.
    const amountDueNum = round2(totalNum - giftcardAppliedNum);

    // -------- 6. Slot capacity check under lock --------
    let deliveryRunId: number | null = null;
    let deliveryDate: string | null = null;
    let sortTime: string | null = null;
    let requestedDeliveryAt: Date | null = null;

    if (checkout.ful === "run") {
      const rid = checkout.rid!;
      // FOR UPDATE: rule 2 of CLAUDE.md, section 2 of the doc. Not an
      // advisory lock, not a plain SELECT. This blocks any other tx
      // trying to book against this run.
      const [runRow] = await tx
        .select({
          id: deliveryRun.id,
          capacity: deliveryRun.capacity,
          isClosed: deliveryRun.isClosed,
          runDate: deliveryRun.runDate,
          windowStart: deliveryRun.windowStart,
        })
        .from(deliveryRun)
        .where(eq(deliveryRun.id, rid))
        .for("update");
      if (!runRow) {
        throw new ReserveError("Dieser Termin existiert nicht mehr.");
      }
      if (runRow.isClosed) {
        throw new ReserveError("Dieser Termin ist geschlossen. Bitte wählen Sie einen anderen.");
      }

      const [countRow] = await tx
        .select({ c: sql<number>`count(*)::int` })
        .from(order)
        .where(and(eq(order.deliveryRunId, rid), ne(order.status, "cancelled")));
      const booked = countRow?.c ?? 0;
      if (booked >= runRow.capacity) {
        throw new ReserveError("Dieser Termin ist leider ausgebucht. Bitte wählen Sie einen anderen.");
      }

      deliveryRunId = runRow.id;
      deliveryDate = runRow.runDate;
      sortTime = runRow.windowStart;
    } else {
      // Timed: cap of settings.timed_deliveries_per_hour per hour.
      // Same lock semantics via pg_advisory_xact_lock keyed on the
      // epoch-hour bucket. Released at COMMIT / ROLLBACK automatically.
      const iso = checkout.rda!;
      const dt = DateTime.fromISO(iso, { zone: ZONE });
      if (!dt.isValid) {
        throw new ReserveError("Ungültiger Zeitpunkt.");
      }
      const hourStart = dt.startOf("hour");
      const hourEnd = hourStart.plus({ hours: 1 });
      const hourEpoch = Math.floor(hourStart.toSeconds());

      await tx.execute(sql`select pg_advisory_xact_lock(${hourEpoch}::bigint)`);

      const cap = await getIntSetting(tx, "timed_deliveries_per_hour", 3);
      const [countRow] = await tx
        .select({ c: sql<number>`count(*)::int` })
        .from(order)
        .where(
          and(
            eq(order.fulfilment, "timed"),
            ne(order.status, "cancelled"),
            sql`${order.requestedDeliveryAt} >= ${hourStart.toISO()}::timestamptz`,
            sql`${order.requestedDeliveryAt} <  ${hourEnd.toISO()}::timestamptz`,
          ),
        );
      const booked = countRow?.c ?? 0;
      if (booked >= cap) {
        throw new ReserveError(
          "Dieser Zeitpunkt ist leider ausgebucht. Bitte wählen Sie einen anderen.",
        );
      }

      requestedDeliveryAt = dt.toJSDate();
      deliveryDate = dt.toISODate();
      sortTime = dt.toFormat("HH:mm:ss");
    }

    // -------- 7. Insert order (every field a snapshot) --------
    const orderNumber = generateOrderNumber();

    const [inserted] = await tx
      .insert(order)
      .values({
        orderNumber,
        // Guest checkout - customerId stays null; accounts are optional
        // post-payment (Auth.js flow, not built here).
        customerId: null,

        buyerName,
        buyerEmail,
        buyerPhone,

        recipientName,
        recipientPhone: checkout.rp ?? null,
        deliveryStreet: street,
        deliveryPlz: zoneRow.plz,
        deliveryCity: zoneRow.ortschaft,
        deliveryZoneName: zoneRow.zoneNameDe,
        deliveryContext: dc,

        deliveryWard: dc === "hospital" ? (checkout.dw ?? null) : null,
        deliveryRoom: dc === "hospital" ? (checkout.dm ?? null) : null,
        deceasedName: dc === "funeral" ? (checkout.dn ?? null) : null,
        familyContactPhone: dc === "funeral" ? (checkout.fc ?? null) : null,

        deliveryInstructions: checkout.di ?? null,
        cardMessage: checkout.cm ?? null,
        cardIsAnonymous: checkout.ca === true,
        ribbonText: dc === "funeral" ? (checkout.rt ?? null) : null,

        fulfilment: checkout.ful === "run" ? "run" : "timed",
        deliveryRunId,
        requestedDeliveryAt,

        // Denormalised for the Heute screen - rule 12 in CLAUDE.md.
        deliveryDate,
        sortTime,

        subtotalGross: subtotalNum.toFixed(2),
        deliveryFeeGross: deliveryFeeNum.toFixed(2),
        deliveryFeeTaxRate,
        giftcardAppliedGross: giftcardAppliedNum.toFixed(2),
        totalGross: totalNum.toFixed(2),
        amountDueGross: amountDueNum.toFixed(2),
      })
      .returning({ id: order.id });

    if (!inserted) throw new ReserveError("Bestellung konnte nicht erstellt werden.");

    // -------- 8. Insert order lines (snapshots) --------
    if (pricedLines.length > 0) {
      await tx.insert(orderLine).values(
        pricedLines.map((l) => ({
          orderId: inserted.id,
          // parentLineId: null for now - add-on support lands with the
          // add-on picker feature. product_id + variant_id kept for
          // REPORTING ONLY, never joined for display (rule 1).
          parentLineId: null,
          productId: l.productId,
          variantId: l.variantId,
          productNameDe: l.productNameDe,
          variantLabelDe: l.variantLabelDe,
          unitPriceGross: l.unitPriceGross.toFixed(2),
          taxRate: l.taxRate,
          quantity: l.quantity,
          lineTotalGross: l.lineTotalGrossNum.toFixed(2),
        })),
      );
    }

    // -------- 9. Insert payment row + (for card/twint) Stripe intent --
    //
    // amount_due = 0 short circuit: skip the payment row AND the Stripe
    // call entirely. Phase 3 gift-card path. Nothing produces a zero
    // in Phase 1 but the schema + code both handle it so the escape
    // hatch works without touching the reserve core when gift cards
    // land.
    //
    // Cash / invoice: payment row goes in with status='pending' and no
    // Stripe intent. Actionable-on-Heute reads method IN ('cash','invoice')
    // regardless of status; admin flips status -> 'succeeded' + fills
    // markedPaidBy when the money actually arrives.
    //
    // Card / TWINT: create the Stripe intent INSIDE this tx (before the
    // payment insert). The intent ties back to the order via metadata;
    // the webhook (Session 6c) matches on providerPaymentIntentId to
    // flip status. Intent creation is a 200-500ms network call inside a
    // held row lock - acceptable at florist scale and simpler than the
    // two-phase alternative (commit tx, then call Stripe, then update
    // payment) which leaves an orphan window if the process dies
    // between the two.
    //
    // Idempotency key = order_number. Stripe SDK auto-retries transient
    // failures; the key means those retries yield the SAME intent, not
    // duplicates. Double-submit at the reserve level generates a new
    // order_number and a new intent - that's a business decision, not
    // an idempotency one, and the FOR UPDATE lock upstream handles
    // capacity.

    let clientSecret: string | undefined;

    if (amountDueNum > 0) {
      const usesStripe = paymentMethod === "card" || paymentMethod === "twint";

      let providerPaymentIntentId: string | null = null;

      if (usesStripe) {
        const stripe = requireStripe();
        const intent = await stripe.paymentIntents.create(
          {
            amount: chfToRappen(amountDueNum),
            currency: "chf",
            // TWINT is a redirect-based method; card is inline. Payment
            // Element picks the right UI. Restricting the allowed
            // methods here is a safety net so a customer can't select
            // e.g. sofort by editing the client.
            payment_method_types:
              paymentMethod === "twint" ? ["twint"] : ["card"],
            metadata: {
              order_id: String(inserted.id),
              order_number: orderNumber,
            },
            // Statement descriptor is bank-line text; keep short + ASCII.
            description: `Magenta Blumen - Bestellung ${orderNumber}`,
          },
          { idempotencyKey: orderNumber },
        );
        providerPaymentIntentId = intent.id;
        clientSecret = intent.client_secret ?? undefined;
      }

      await tx.insert(payment).values({
        orderId: inserted.id,
        method: paymentMethod,
        providerPaymentIntentId,
        amountGross: amountDueNum.toFixed(2),
        // Card/twint status STAYS 'pending' until the webhook flips it
        // to 'succeeded'. Cash/invoice status STAYS 'pending' until
        // admin marks paid (fills marked_paid_by). Same field, two
        // different lifecycles.
        status: "pending",
        markedPaidBy: null,
      });
    }

    return {
      orderId: inserted.id,
      orderNumber,
      totalGross: totalNum.toFixed(2),
      amountDueGross: amountDueNum.toFixed(2),
      clientSecret,
    };
  });
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function getIntSetting(
  tx: Parameters<Parameters<DbClient["transaction"]>[0]>[0],
  key: string,
  fallback: number,
): Promise<number> {
  const [row] = await tx
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, key))
    .limit(1);
  if (!row) return fallback;
  const n = Number(row.value);
  return Number.isInteger(n) ? n : fallback;
}
