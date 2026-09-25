"use client";

import { useTransition } from "react";
import {
  removeCartLineAction,
  setCartLineQtyAction,
} from "@/lib/cart/actions";

/**
 * Qty stepper + remove button for one cart line. Client component
 * because it calls server actions and needs a pending state so the
 * UI feels responsive on the 200-500ms round-trip.
 *
 * The parent cart page is a server component and re-renders when
 * revalidatePath("/", "layout") fires inside the action - meaning
 * the qty / subtotal / badge count all update from the server. This
 * component owns no state of its own; it dispatches and waits.
 */
export function CartLineControls({
  productId,
  variantId,
  qty,
}: {
  productId: number;
  variantId: number;
  qty: number;
}) {
  const [isPending, startTransition] = useTransition();

  function setQty(newQty: number) {
    startTransition(async () => {
      await setCartLineQtyAction(productId, variantId, newQty);
    });
  }

  function remove() {
    startTransition(async () => {
      await removeCartLineAction(productId, variantId);
    });
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center border border-mist h-9">
        <button
          type="button"
          aria-label="Menge verringern"
          disabled={isPending || qty <= 1}
          onClick={() => setQty(qty - 1)}
          className="w-8 h-full text-[1rem] text-bark hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          −
        </button>
        <span
          aria-live="polite"
          className={`w-8 text-center text-[0.85rem] font-medium text-bark tabular-nums ${isPending ? "opacity-40" : ""}`}
        >
          {qty}
        </span>
        <button
          type="button"
          aria-label="Menge erhöhen"
          disabled={isPending || qty >= 99}
          onClick={() => setQty(qty + 1)}
          className="w-8 h-full text-[1rem] text-bark hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          +
        </button>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={remove}
        className="inline-block px-3 py-1 border border-rose text-rose text-[0.65rem] tracking-[0.1em] uppercase font-medium hover:bg-rose hover:text-ivory transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Entfernen
      </button>
    </div>
  );
}
