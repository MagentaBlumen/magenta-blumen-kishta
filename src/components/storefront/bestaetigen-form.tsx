"use client";

import { useState, useTransition } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { CoTile } from "@/components/storefront/co-tile";
import { reserveOrderAction } from "@/lib/checkout/actions";
import { getStripe } from "@/lib/checkout/stripe-browser";

// Payment method picker + two-phase reserve flow.
//
// Phase 1: user picks method + clicks "Kostenpflichtig bestellen".
//   cash / invoice -> server action reserves order + redirect()s to
//     /kasse/erfolg. UI never reaches phase 2.
//   card / twint   -> server action reserves order + creates Stripe
//     PaymentIntent + returns { orderNumber, clientSecret }. UI mounts
//     <Elements> with the clientSecret and shows the PaymentElement.
//
// Phase 2 (card/twint only): PaymentElement + Stripe confirm, which
// redirects the browser to /kasse/erfolg?bestellnummer=... on success.
// The webhook (api/webhooks/stripe) flips payment.status to succeeded
// and fires the confirmation emails.

type MethodValue = "invoice" | "cash" | "card" | "twint";

export function BestaetigenForm() {
  const [method, setMethod] = useState<MethodValue>("twint");

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

  if (pending) {
    return (
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[14px] text-bark leading-[1.5]">
          Ihre Bestellung{" "}
          <span className="tabular-nums font-semibold">
            {pending.orderNumber}
          </span>{" "}
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

  return (
    <div className="flex flex-col gap-5">
      <div
        role="radiogroup"
        aria-label="Zahlungsart"
        className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]"
      >
        <PayTile
          selected={method === "card"}
          onClick={() => setMethod("card")}
          title="Karte"
          sub="Visa, Mastercard, American Express – sicher über Stripe."
        />
        <PayTile
          selected={method === "twint"}
          onClick={() => setMethod("twint")}
          title="TWINT"
          sub="Mit der TWINT-App auf Ihrem Handy."
        />
        <PayTile
          selected={method === "invoice"}
          onClick={() => setMethod("invoice")}
          title="Rechnung"
          sub="Per E-Mail, zahlbar innert 30 Tagen."
        />
        <PayTile
          selected={method === "cash"}
          onClick={() => setMethod("cash")}
          title="Barzahlung"
          sub="Bei Abholung oder an der Haustür."
        />
      </div>

      {error && (
        <p
          role="alert"
          className="m-0 px-4 py-3 border border-rose/40 bg-rose/5 text-[13px] text-bark leading-[1.5]"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={isReserving}
        onClick={submit}
        className="h-14 bg-rose text-ivory text-[16px] font-semibold tracking-[0.02em] hover:brightness-110 transition-[filter] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isReserving
          ? "Bestellung wird abgesendet…"
          : method === "card" || method === "twint"
            ? "Weiter zur Zahlung"
            : "Kostenpflichtig bestellen"}
      </button>

      <p className="m-0 text-[12px] text-sage leading-[1.5] text-center">
        Mit Ihrer Bestellung akzeptieren Sie die{" "}
        <a href="/agb" className="underline text-sage hover:text-rose transition-colors">
          AGB
        </a>{" "}
        und die{" "}
        <a
          href="/datenschutz"
          className="underline text-sage hover:text-rose transition-colors"
        >
          Datenschutzerklärung
        </a>
        .
      </p>
    </div>
  );
}

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
    const returnUrl = `${window.location.origin}/kasse/erfolg?bestellnummer=${encodeURIComponent(orderNumber)}`;
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    if (err) {
      setError(err.message ?? "Zahlung konnte nicht abgeschlossen werden.");
    }
    setConfirming(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement />
      {error && (
        <p
          role="alert"
          className="m-0 px-4 py-3 border border-rose/40 bg-rose/5 text-[13px] text-bark"
        >
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={confirm}
        disabled={!stripe || !elements || confirming}
        className="h-14 bg-rose text-ivory text-[16px] font-semibold tracking-[0.02em] hover:brightness-110 transition-[filter] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {confirming
          ? "Zahlung wird verarbeitet…"
          : method === "twint"
            ? "Mit TWINT bezahlen"
            : "Jetzt bezahlen"}
      </button>
      <p className="m-0 text-[12px] text-sage leading-[1.5] text-center">
        Zahlung wird über Stripe abgewickelt. Wir speichern keine Kartendaten.
      </p>
    </div>
  );
}

function PayTile({
  selected,
  onClick,
  title,
  sub,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <CoTile selected={selected} onClick={onClick}>
      <span className="text-[15px] font-semibold text-bark">{title}</span>
      <span className="text-[13px] leading-[1.5] text-sage">{sub}</span>
    </CoTile>
  );
}

// Match the site palette on Stripe's PaymentElement.
const MAGENTA_APPEARANCE: Appearance = {
  theme: "flat",
  variables: {
    colorPrimary: "#A3165F",
    colorBackground: "#fdfcf9",
    colorText: "#3A2719",
    colorDanger: "#A3165F",
    fontFamily: "'Instrument Sans', system-ui, -apple-system, sans-serif",
    borderRadius: "0",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": {
      border: "1px solid #E1D5C7",
      backgroundColor: "#fdfcf9",
    },
    ".Input:focus": {
      border: "1px solid #A3165F",
      boxShadow: "0 0 0 2px rgba(163,22,95,0.15)",
    },
    ".Label": {
      fontSize: "13px",
      fontWeight: "600",
      color: "#3A2719",
    },
  },
};
