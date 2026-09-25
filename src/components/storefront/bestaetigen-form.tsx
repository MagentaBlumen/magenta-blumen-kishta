"use client";

import { useState, useTransition } from "react";
import { reserveOrderAction } from "@/lib/checkout/actions";

/**
 * Payment method picker + reserve trigger.
 *
 * Only 'cash' and 'invoice' are wired today. When Session 6 lands the
 * Stripe integration, 'card' and 'twint' get added here and this
 * component switches to redirecting to a Stripe Elements form for
 * those methods; cash + invoice keep flowing straight to
 * reserveOrderAction which finishes the reserve+payment loop in one
 * transaction.
 */
export function BestaetigenForm() {
  const [method, setMethod] = useState<"cash" | "invoice">("invoice");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await reserveOrderAction(method);
        // Server action redirects on success; unreachable.
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-[0.72rem] tracking-[0.16em] uppercase font-medium text-bark">
          Zahlungsart
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
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
        <p className="text-[0.72rem] text-sage leading-[1.55]">
          Kartenzahlung und TWINT werden in Kürze aufgeschaltet.
        </p>
      </section>

      {error && (
        <p className="px-4 py-3 border border-rose/30 bg-rose/5 text-[0.85rem] text-bark">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={submit}
        className="w-full h-[52px] bg-rose text-ivory text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-[#831249] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? "Bestellung wird abgesendet ..." : "Kostenpflichtig bestellen"}
      </button>

      <p className="text-[0.7rem] text-sage leading-[1.55] text-center">
        Mit Klick akzeptieren Sie die AGB und die Datenschutzerklärung.
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
