import "server-only";
import { eq, sql } from "drizzle-orm";
import { db as defaultDb } from "@/db/client";
import { customer } from "@/db/schema/customer";
import { order, orderLine } from "@/db/schema/order";
import { payment } from "@/db/schema/payment";
import {
  createEmailVerificationToken,
  createPasswordResetToken,
} from "@/lib/customer-auth/account-tokens";
import { createOrderDeepLinkToken } from "@/lib/order-lookup/token";
import {
  fromAddress,
  isEmailConfigured,
  resend,
  shopAddress,
} from "./resend";
import {
  anonymisedEmail,
  buyerConfirmationEmail,
  buyerStatusEmail,
  contactFormAckEmail,
  contactFormShopEmail,
  passwordChangedEmail,
  passwordResetEmail,
  paymentFailedEmail,
  shopNotificationEmail,
  welcomeVerifyEmail,
  type AccountEmailCustomer,
  type ContactFormInput,
  type OrderEmailData,
  type OrderEmailLine,
  type PaymentFailedEmailData,
  type StatusEmailKind,
} from "./templates";

/**
 * Send both the buyer confirmation + shop notification for one order.
 *
 * NEVER THROWS. From docs/checkout-transaction.md §4 step 16:
 *   "A failing email must not roll back a successful payment."
 *
 * Caller fires this AFTER the DB transaction commits. If email send
 * fails, we log and move on - the order is good, the money is good,
 * the audit trail is good. Resend-side failures (rate limit, domain
 * not verified, bad from-address) show up in Resend's dashboard; we
 * surface them in server logs.
 *
 * Quietly no-ops when Resend isn't configured (no API key or no from
 * address). That's the right behaviour for CI builds and for the
 * stretch between code landing and the stopgap domain being bought.
 */

type DbClient = typeof defaultDb;

export async function sendOrderEmails(
  orderId: number,
  dbClient: DbClient = defaultDb,
): Promise<{ buyer: "sent" | "skipped" | "failed"; shop: "sent" | "skipped" | "failed" }> {
  if (!isEmailConfigured()) {
    console.log(
      `[email] skipping sends for order ${orderId}: RESEND_API_KEY or RESEND_FROM_ADDRESS not set`,
    );
    return { buyer: "skipped", shop: "skipped" };
  }

  let data: OrderEmailData;
  try {
    data = await loadOrderEmailData(orderId, dbClient);
  } catch (err) {
    console.error(
      `[email] failed to load order ${orderId} for email dispatch:`,
      err,
    );
    return { buyer: "failed", shop: "failed" };
  }

  const [buyerOutcome, shopOutcome] = await Promise.all([
    sendBuyer(data),
    sendShop(data),
  ]);
  return { buyer: buyerOutcome, shop: shopOutcome };
}

async function sendBuyer(data: OrderEmailData): Promise<"sent" | "failed"> {
  const from = fromAddress();
  if (!resend || !from) return "failed";
  const tmpl = buyerConfirmationEmail(data, orderDeepLinkUrl(data.orderNumber));
  // replyTo = shop inbox so a buyer's "wait, change the card message"
  // reply reaches Sandra, not a bounce at the RESEND_FROM_ADDRESS.
  const replyTo = shopAddress() ?? from;
  try {
    const { error } = await resend.emails.send({
      from,
      to: data.buyerEmail,
      replyTo,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (error) {
      console.error(
        `[email] buyer send failed for ${data.orderNumber}:`,
        error,
      );
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(
      `[email] buyer send threw for ${data.orderNumber}:`,
      err,
    );
    return "failed";
  }
}

async function sendShop(data: OrderEmailData): Promise<"sent" | "failed"> {
  const from = fromAddress();
  const shop = shopAddress() ?? from;
  if (!resend || !from || !shop) return "failed";
  const tmpl = shopNotificationEmail(data);
  try {
    const { error } = await resend.emails.send({
      from,
      to: shop,
      replyTo: data.buyerEmail,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (error) {
      console.error(
        `[email] shop send failed for ${data.orderNumber}:`,
        error,
      );
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(
      `[email] shop send threw for ${data.orderNumber}:`,
      err,
    );
    return "failed";
  }
}

/**
 * Fire a single buyer email for a status transition - "unterwegs",
 * "zugestellt", or "fehlgeschlagen". Called from
 * updateOrderStatusAction right after the DB flip commits.
 *
 * NEVER THROWS, same contract as sendOrderEmails. A failing email
 * must not undo the status flip Sandra just made.
 *
 * No per-transition idempotency: if the admin bounces status (e.g.
 * ready -> delivery_failed by mistake -> ready) the "fehlgeschlagen"
 * email already went out. Rare in practice; the alternative is three
 * timestamp columns on `order` which is a schema change we don't
 * need yet.
 */
export async function sendBuyerStatusEmail(
  orderId: number,
  kind: StatusEmailKind,
  dbClient: DbClient = defaultDb,
): Promise<"sent" | "skipped" | "failed"> {
  if (!isEmailConfigured()) {
    console.log(
      `[email] skipping ${kind} status email for order ${orderId}: Resend not configured`,
    );
    return "skipped";
  }

  let data: OrderEmailData;
  try {
    data = await loadOrderEmailData(orderId, dbClient);
  } catch (err) {
    console.error(
      `[email] failed to load order ${orderId} for ${kind} status email:`,
      err,
    );
    return "failed";
  }

  const from = fromAddress();
  if (!resend || !from) return "failed";

  const tmpl = buyerStatusEmail(data, kind, orderDeepLinkUrl(data.orderNumber));
  const replyTo = shopAddress() ?? from;
  try {
    const { error } = await resend.emails.send({
      from,
      to: data.buyerEmail,
      replyTo,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (error) {
      console.error(
        `[email] ${kind} status email send failed for ${data.orderNumber}:`,
        error,
      );
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(
      `[email] ${kind} status email send threw for ${data.orderNumber}:`,
      err,
    );
    return "failed";
  }
}

/**
 * Pull everything the templates need in one round of queries.
 * Deliberately reads order_line SNAPSHOTS - never joins back to
 * product (rule 1). Price shown in the email is what was captured
 * at reserve time, even if the live product price has since changed.
 */
export async function loadOrderEmailData(
  orderId: number,
  dbClient: DbClient = defaultDb,
): Promise<OrderEmailData> {
  const [o] = await dbClient
    .select()
    .from(order)
    .where(eq(order.id, orderId))
    .limit(1);
  if (!o) throw new Error(`order ${orderId} not found`);

  const [lines, [pay]] = await Promise.all([
    dbClient
      .select({
        productNameDe: orderLine.productNameDe,
        variantLabelDe: orderLine.variantLabelDe,
        quantity: orderLine.quantity,
        unitPriceGross: orderLine.unitPriceGross,
        lineTotalGross: orderLine.lineTotalGross,
        taxRate: orderLine.taxRate,
      })
      .from(orderLine)
      .where(eq(orderLine.orderId, orderId)),
    dbClient
      .select({ method: payment.method })
      .from(payment)
      .where(eq(payment.orderId, orderId))
      .limit(1),
  ]);

  // Fall back to 'invoice' for the (rare) amount_due=0 orders that
  // skipped the payment-row insert. Templates handle the label.
  const paymentMethod: OrderEmailData["paymentMethod"] = pay?.method ?? "invoice";

  const emailLines: OrderEmailLine[] = lines.map((l) => ({
    productNameDe: l.productNameDe,
    variantLabelDe: l.variantLabelDe,
    quantity: l.quantity,
    unitPriceGross: l.unitPriceGross,
    lineTotalGross: l.lineTotalGross,
    taxRate: l.taxRate,
  }));

  return {
    orderNumber: o.orderNumber,
    buyerName: o.buyerName,
    buyerEmail: o.buyerEmail,
    buyerPhone: o.buyerPhone ?? "",
    recipientName: o.recipientName,
    recipientPhone: o.recipientPhone,
    deliveryStreet: o.deliveryStreet ?? "",
    deliveryPlz: o.deliveryPlz ?? "",
    deliveryCity: o.deliveryCity ?? "",
    deliveryZoneName: o.deliveryZoneName ?? "",
    fulfilment: o.fulfilment,
    deliveryDate: o.deliveryDate,
    sortTime: o.sortTime,
    requestedDeliveryAt: o.requestedDeliveryAt,
    cardMessage: o.cardMessage,
    cardIsAnonymous: o.cardIsAnonymous,
    ribbonText: o.ribbonText,
    deliveryInstructions: o.deliveryInstructions,
    deliveryContext: o.deliveryContext,
    deliveryWard: o.deliveryWard,
    deliveryRoom: o.deliveryRoom,
    deceasedName: o.deceasedName,
    familyContactPhone: o.familyContactPhone,
    subtotalGross: o.subtotalGross,
    deliveryFeeGross: o.deliveryFeeGross,
    deliveryFeeTaxRate: o.deliveryFeeTaxRate,
    totalGross: o.totalGross,
    paymentMethod,
    lines: emailLines,
  };
}

// ------------------------------------------------------------------
// Account lifecycle — welcome / password reset
// ------------------------------------------------------------------

type Outcome = "sent" | "skipped" | "failed";

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://178-104-239-168.nip.io"
  );
}

/**
 * Build the signed deep-link URL that lands the buyer on their order
 * status page without any form entry. Embedded in every outbound
 * order e-mail (confirmation + status + storniert). The click target
 * verifies the signature, mints a 24 h view-cookie, and redirects to
 * /bestellung-finden/[orderNumber].
 */
export function orderDeepLinkUrl(orderNumber: string): string {
  const token = createOrderDeepLinkToken(orderNumber);
  return `${siteUrl()}/bestellung-finden/zugang/${token}`;
}

/**
 * Send the welcome + email-verification mail after signup.
 *
 * Fire-and-forget. Never throws — a Resend outage or missing config
 * must not break the signup flow that just ran and the signIn
 * redirect that is about to follow.
 */
export async function sendWelcomeEmail(
  customerId: number,
  dbClient: DbClient = defaultDb,
): Promise<Outcome> {
  if (!isEmailConfigured()) return "skipped";
  try {
    const [row] = await dbClient
      .select({
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      })
      .from(customer)
      .where(eq(customer.id, customerId))
      .limit(1);
    if (!row) return "failed";

    const verifyToken = createEmailVerificationToken(customerId);
    const verifyUrl = `${siteUrl()}/konto/email-bestaetigen/${verifyToken}`;
    const tmpl = welcomeVerifyEmail(row, verifyUrl);

    const from = fromAddress();
    if (!resend || !from) return "failed";
    const replyTo = shopAddress() ?? from;
    const { error } = await resend.emails.send({
      from,
      to: row.email,
      replyTo,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (error) {
      console.error(
        `[email] welcome send failed for customer ${customerId}:`,
        error,
      );
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(
      `[email] sendWelcomeEmail threw for customer ${customerId}:`,
      err,
    );
    return "failed";
  }
}

/**
 * Confirm a successful password change. Fired AFTER the DB commit of
 * resetPasswordAction or changePasswordAction. Includes a prominent
 * "if this wasn't you, call us" line — the fastest escalation path
 * for a compromised account.
 *
 * Never throws.
 */
export async function sendPasswordChangedEmail(
  customerId: number,
  dbClient: DbClient = defaultDb,
): Promise<Outcome> {
  if (!isEmailConfigured()) return "skipped";
  try {
    const [row] = await dbClient
      .select({
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        anonymisedAt: customer.anonymisedAt,
      })
      .from(customer)
      .where(eq(customer.id, customerId))
      .limit(1);
    if (!row || row.anonymisedAt) return "skipped";

    const tmpl = passwordChangedEmail(row);
    const from = fromAddress();
    if (!resend || !from) return "failed";
    const replyTo = shopAddress() ?? from;
    const { error } = await resend.emails.send({
      from,
      to: row.email,
      replyTo,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (error) {
      console.error(
        `[email] password-changed send failed for customer ${customerId}:`,
        error,
      );
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(
      `[email] sendPasswordChangedEmail threw for customer ${customerId}:`,
      err,
    );
    return "failed";
  }
}

/**
 * FADP farewell e-mail. Caller passes the PRE-anonymisation snapshot
 * — we must have the real email + name before the DB nulls them.
 * Call this AFTER `anonymiseCustomer` commits.
 *
 * Never throws.
 */
export async function sendAnonymisationEmail(
  snapshot: AccountEmailCustomer,
): Promise<Outcome> {
  if (!isEmailConfigured()) return "skipped";
  try {
    const from = fromAddress();
    if (!resend || !from) return "failed";
    const tmpl = anonymisedEmail(snapshot);
    // No replyTo — the account is gone; a reply landing anywhere
    // sends a confusing signal. The From address + shop phone in
    // the template cover the "wait, undo this" edge.
    const { error } = await resend.emails.send({
      from,
      to: snapshot.email,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (error) {
      console.error(`[email] anonymisation farewell send failed:`, error);
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(`[email] sendAnonymisationEmail threw:`, err);
    return "failed";
  }
}

/**
 * Password reset. Caller passes the typed email verbatim; we look it
 * up case-insensitively. Returns the same "sent"/"skipped" outcome
 * regardless of whether the email matched a real row — the action
 * will always render "wir haben Ihnen eine Mail geschickt" to prevent
 * user-enumeration.
 *
 * Fire-and-forget on the action's side. Never throws.
 */
export async function sendPasswordResetEmail(
  emailRaw: string,
  dbClient: DbClient = defaultDb,
): Promise<Outcome> {
  if (!isEmailConfigured()) return "skipped";
  const email = emailRaw.trim().toLowerCase();
  if (!email) return "failed";
  try {
    const [row] = await dbClient
      .select({
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        passwordHash: customer.passwordHash,
        anonymisedAt: customer.anonymisedAt,
      })
      .from(customer)
      .where(sql`lower(${customer.email}) = ${email}`)
      .limit(1);

    // No row, or anonymised row → silently skip. Caller still shows a
    // success-shaped message so the response doesn't reveal whether
    // the email is on file.
    if (!row || row.anonymisedAt) return "skipped";

    const token = createPasswordResetToken(row.id, row.passwordHash);
    const resetUrl = `${siteUrl()}/konto/passwort-zuruecksetzen/${token}`;
    const tmpl = passwordResetEmail(row, resetUrl);

    const from = fromAddress();
    if (!resend || !from) return "failed";
    const replyTo = shopAddress() ?? from;
    const { error } = await resend.emails.send({
      from,
      to: row.email,
      replyTo,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (error) {
      console.error(
        `[email] password-reset send failed for ${row.email}:`,
        error,
      );
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(`[email] sendPasswordResetEmail threw:`, err);
    return "failed";
  }
}

// ------------------------------------------------------------------
// Payment failed (card / TWINT declined)
// ------------------------------------------------------------------

/**
 * Called from the Stripe webhook after a `payment_intent.payment_failed`
 * flipped the payment row to 'failed'. Never throws.
 */
export async function sendPaymentFailedEmail(
  orderId: number,
  dbClient: DbClient = defaultDb,
): Promise<Outcome> {
  if (!isEmailConfigured()) return "skipped";
  try {
    const [row] = await dbClient
      .select({
        orderNumber: order.orderNumber,
        buyerName: order.buyerName,
        buyerEmail: order.buyerEmail,
        totalGross: order.totalGross,
      })
      .from(order)
      .where(eq(order.id, orderId))
      .limit(1);
    if (!row) return "failed";

    const [pay] = await dbClient
      .select({ method: payment.method })
      .from(payment)
      .where(eq(payment.orderId, orderId))
      .limit(1);

    const method = pay?.method;
    if (method !== "card" && method !== "twint") {
      // Payment-failed only makes sense for card / TWINT. Cash and
      // invoice are actionable at creation; they never go through a
      // provider failure flow.
      return "skipped";
    }

    const data: PaymentFailedEmailData = {
      orderNumber: row.orderNumber,
      buyerName: row.buyerName,
      totalGross: row.totalGross,
      paymentMethod: method,
    };
    const tmpl = paymentFailedEmail(data);

    const from = fromAddress();
    if (!resend || !from) return "failed";
    const replyTo = shopAddress() ?? from;
    const { error } = await resend.emails.send({
      from,
      to: row.buyerEmail,
      replyTo,
      subject: tmpl.subject,
      html: tmpl.html,
      text: tmpl.text,
    });
    if (error) {
      console.error(
        `[email] payment-failed send failed for ${row.orderNumber}:`,
        error,
      );
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.error(
      `[email] sendPaymentFailedEmail threw for order ${orderId}:`,
      err,
    );
    return "failed";
  }
}

// ------------------------------------------------------------------
// Contact form
// ------------------------------------------------------------------

/**
 * Deliver a contact-form submission: one email to the shop inbox
 * (with replyTo pointing at the submitter) + one auto-ack back to the
 * submitter. Returns both outcomes. Never throws.
 */
export async function sendContactFormMessage(
  input: ContactFormInput,
): Promise<{ shop: Outcome; ack: Outcome }> {
  if (!isEmailConfigured()) return { shop: "skipped", ack: "skipped" };
  const from = fromAddress();
  const shop = shopAddress() ?? from;
  if (!resend || !from || !shop) {
    return { shop: "failed", ack: "failed" };
  }

  const shopTmpl = contactFormShopEmail(input);
  const ackTmpl = contactFormAckEmail(input);

  const [shopResult, ackResult] = await Promise.all([
    resend.emails
      .send({
        from,
        to: shop,
        replyTo: input.email,
        subject: shopTmpl.subject,
        html: shopTmpl.html,
        text: shopTmpl.text,
      })
      .then(
        ({ error }): Outcome => {
          if (error) {
            console.error(`[email] contact-form shop send failed:`, error);
            return "failed";
          }
          return "sent";
        },
      )
      .catch((err): Outcome => {
        console.error(`[email] contact-form shop send threw:`, err);
        return "failed";
      }),
    resend.emails
      .send({
        from,
        to: input.email,
        replyTo: shop,
        subject: ackTmpl.subject,
        html: ackTmpl.html,
        text: ackTmpl.text,
      })
      .then(
        ({ error }): Outcome => {
          if (error) {
            console.error(`[email] contact-form ack send failed:`, error);
            return "failed";
          }
          return "sent";
        },
      )
      .catch((err): Outcome => {
        console.error(`[email] contact-form ack send threw:`, err);
        return "failed";
      }),
  ]);
  return { shop: shopResult, ack: ackResult };
}
