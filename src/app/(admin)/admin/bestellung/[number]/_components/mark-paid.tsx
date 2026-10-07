"use client";

import { useState, useTransition } from "react";
import { markPaymentPaidAction } from "../actions";

/**
 * Mark-paid button for cash/invoice payments. Dropdown picks who
 * handled the payment, filled into payment.marked_paid_by so a
 * single-shared-admin credential can still produce a usable audit
 * trail. "Shop" is the sensible default when it's not clear.
 *
 * Card/TWINT payments never render this component - the action
 * refuses them server-side anyway as belt + braces.
 */
export function MarkPaidButton({
  paymentId,
}: {
  paymentId: number;
}) {
  const [picker, setPicker] = useState<"Shop" | "Sandra" | "Inhaberin" | "Andere">("Shop");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await markPaymentPaidAction(paymentId, picker);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={picker}
        onChange={(e) =>
          setPicker(e.target.value as typeof picker)
        }
        disabled={isPending}
        className="h-9 px-2 border border-input bg-background text-sm rounded-md disabled:opacity-50"
      >
        <option value="Shop">Shop</option>
        <option value="Sandra">Sandra</option>
        <option value="Inhaberin">Inhaberin</option>
        <option value="Andere">Andere</option>
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50"
      >
        {isPending ? "Wird markiert …" : "Als bezahlt markieren"}
      </button>
      {error && (
        <span className="text-sm text-rose-600">{error}</span>
      )}
    </div>
  );
}
