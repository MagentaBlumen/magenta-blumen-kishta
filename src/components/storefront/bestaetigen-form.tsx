"use client";

import { useState, useTransition } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { reserveOrderAction } from "@/lib/checkout/actions";
import { getStripe } from "@/lib/checkout/stripe-browser";

/**
 * Payment method picker + two-phase reserve flow.
 *
 * Phase 1: user picks method + clicks "Kostenpflichtig bestellen".
 *   cash / invoice -> server action reserves order + redirect()s to
 *     /kasse/erfolg. UI never reaches phase 2.
 *   card / twint   -> server action reserves order + creates Stripe
 *     PaymentIntent + returns { orderNumber, clientSecret }. UI mounts
 *     <Elements> below with the clientSecret and shows the
 *     PaymentElement (card fields or TWINT redirect prompt).
 *
 * Phase 2 (card/twint only): user fills the PaymentElement + clicks
 *   "Jetzt bezahlen" -> stripe.confirmPayment({ return_url }). Stripe
 *   handles the 3DS / TWINT redirect + eventually navigates the
 *   browser to /kasse/erfolg?bestellnummer=<order-number>. The webhook
 *   (Session 6c) is what actually flips payment.status to succeeded.
 */

type MethodValue = "invoice" | "cash" | "card" | "twint";

export function BestaetigenForm() {
  const [method, setMethod] = useState<MethodValue>("invoice");

  // After a successful reserve for card/twint, we hold onto the pair.
  // Rendering shifts from the method picker to the Elements panel.
  const [pending, setPending] = useState<{
    orderNumber: string;
    clientSecret: string;
    method: "card" | "twint";
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [isReserving, startReserving] = useTransition();

  function submit() {
    setError(null);
    startReserving(async () => {
      try {
        const result = await reserveOrderAction(method);
        // Cash/invoice never reach here - server redirect()ed. If we
        // got a return with no clientSecret for card/twint, the action
        // already threw and we're in the catch. Belt-and-braces:
        if (method === "card" || method === "twint") {
          if (!result?.clientSecret) {
            setError("Zahlung konnte nicht initialisiert werden.");
            return;
          }
          setPending({
            orderNumber: result.orderNumber,
            clientSecret: result.clientSecret,
            method,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  // Phase 2 for card/twint.
  if (pending) {
    return (
      <div className="space-y-4">
        <p className="text-[0.85rem] text-bark leading-[1.55]">
          Ihre Bestellung <span className="tabular-nums font-medium">{pending.orderNumber}</span>{" "}
          ist reserviert. Bitte schliessen Sie die Zahlung ab.
        </p>
        <Elements
          stripe={getStripe()}
          options={{
            clientSecret: pending.clientSecret,
            appearance: MAGENTA_APPEARANCE,
            locale: "de",
          }}
        >
          <StripeConfirmPanel
            orderNumber={pending.orderNumber}
            method={pending.method}
          />
        </Elements>
      </div>
    );
  }

  // Phase 1 - method picker + submit.
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-[0.72rem] tracking-[0.16em] uppercase font-medium text-bark">
          Zahlungsart
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <MethodButton
            active={method === "card"}
            onClick={() => setMethod("card")}
            title="Karte"
            body="Visa, Mastercard, American Express. Sichere Zahlung über Stripe."
          />
          <MethodButton
            active={method === "twint"}
            onClick={() => setMethod("twint")}
            title="TWINT"
            body="Zahlung über die TWINT-App auf Ihrem Handy."
          />
          <MethodButton
            active={method === "invoice"}
            onClick={() => setMethod("invoice")}
            title="Rechnung"
            body="Wir schicken Ihnen eine Rechnung per E-Mail. Zahlungsziel 30 Tage."
          />
          <MethodButton
            active={method === "cash"}
            onClick={() => setMethod("cash")}
            title="Barzahlung"
            body="Bezahlung bei Abholung im Laden oder an der Haustür an die Fahrerin."
          />
        </div>
      </section>

      {error && (
        <p className="px-4 py-3 border border-rose/30 bg-rose/5 text-[0.85rem] text-bark">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={isReserving}
        onClick={submit}
        className="w-full h-[52px] bg-rose text-ivory text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-[#831249] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isReserving
          ? "Bestellung wird abgesendet ..."
          : method === "card" || method === "twint"
            ? "Weiter zur Zahlung"
            : "Kostenpflichtig bestellen"}
      </button>

      <p className="text-[0.7rem] text-sage leading-[1.55] text-center">
        Mit Klick akzeptieren Sie die AGB und die Datenschutzerklärung.
      </p>
    </div>
  );
}

/**
 * Inner client component that lives INSIDE <Elements> so it can use
 * useStripe() + useElements(). Confirms the payment via Stripe and
 * lets Stripe redirect the browser to /kasse/erfolg on success.
 */
function StripeConfirmPanel({
  orderNumber,
  method,
}: {
  orderNumber: string;
  method: "card" | "twint";
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function confirm() {
    if (!stripe || !elements) return;
    setError(null);
    setConfirming(true);
    // return_url is where Stripe sends the browser after a successful
    // confirm (or after a redirect flow like TWINT / 3DS). Use the
    // browser's origin so it works across dev / prod without a config.
    const returnUrl = `${window.location.origin}/kasse/erfolg?bestellnummer=${encodeURIComponent(orderNumber)}`;
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    // If we're still here, confirmPayment did NOT redirect - that
    // means it failed synchronously (validation error, declined card
    // that doesn't need 3DS, etc). Show the message; the customer can
    // try again with different details.
    if (err) {
      setError(err.message ?? "Zahlung konnte nicht abgeschlossen werden.");
    }
    setConfirming(false);
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && (
        <p className="px-4 py-3 border border-rose/30 bg-rose/5 text-[0.85rem] text-bark">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={confirm}
        disabled={!stripe || !elements || confirming}
        className="w-full h-[52px] bg-rose text-ivory text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-[#831249] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {confirming
          ? "Zahlung wird verarbeitet ..."
          : method === "twint"
            ? "Mit TWINT bezahlen"
            : "Jetzt bezahlen"}
      </button>
      <p className="text-[0.7rem] text-sage leading-[1.55] text-center">
        Zahlung wird über Stripe abgewickelt. Wir speichern keine
        Kartendaten.
      </p>
    </div>
  );
}

function MethodButton({
  active,
  onClick,
  title,
  body,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left px-4 py-3 border transition-colors ${
        active
          ? "border-bark bg-bark text-ivory"
          : "border-mist text-bark hover:border-bark"
      }`}
    >
      <div className={`text-[0.85rem] font-medium ${active ? "text-ivory" : "text-bark"}`}>
        {title}
      </div>
      <p className={`text-[0.72rem] mt-1 leading-[1.55] ${active ? "text-cream/80" : "text-sage"}`}>
        {body}
      </p>
    </button>
  );
}

// Match the site palette: bark text, ivory background, rose accent.
// Stripe's Payment Element inherits these tokens.
const MAGENTA_APPEARANCE: Appearance = {
  theme: "flat",
  variables: {
    colorPrimary: "#a0185a",
    colorBackground: "#fdfcf9",
    colorText: "#2a1f1a",
    colorDanger: "#a0185a",
    fontFamily:
      "'DM Sans', system-ui, -apple-system, sans-serif",
    borderRadius: "0",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #ede9e3",
      backgroundColor: "#fdfcf9",
    },
    ".Input:focus": {
      border: "1px solid #2a1f1a",
      boxShadow: "none",
    },
    ".Label": {
      fontSize: "0.72rem",
      color: "#2a1f1a",
    },
  },
};
