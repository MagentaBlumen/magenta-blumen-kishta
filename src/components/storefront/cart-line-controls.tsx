"use client";

import { useTransition } from "react";
import {
  removeCartLineAction,
  setCartLineQtyAction,
} from "@/lib/cart/actions";

// Qty stepper + remove button for one cart line. Client component
// because it calls server actions and needs a pending state so the
// UI feels responsive on the 200-500ms round-trip.
//
// The parent cart page is a server component and re-renders when
// revalidatePath("/", "layout") fires inside the action — meaning
// the qty / subtotal / badge count all update from the server.
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div
        role="group"
        aria-label="Menge"
        className="flex items-center border border-[#E1D5C7] h-10"
      >
        <button
          type="button"
          aria-label="Menge verringern"
          disabled={isPending || qty <= 1}
          onClick={() => setQty(qty - 1)}
          className="w-10 h-full text-[18px] text-bark hover:text-rose disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          −
        </button>
        <span
          aria-live="polite"
          className={`w-8 text-center text-[15px] font-semibold text-bark tabular-nums ${
            isPending ? "opacity-40" : ""
          }`}
        >
          {qty}
        </span>
        <button
          type="button"
          aria-label="Menge erhöhen"
          disabled={isPending || qty >= 99}
          onClick={() => setQty(qty + 1)}
          className="w-10 h-full text-[18px] text-bark hover:text-rose disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          +
        </button>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={remove}
        className="inline-flex items-center gap-2 h-10 px-1 text-[13px] text-sage hover:text-rose disabled:opacity-40 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" />
        </svg>
        Entfernen
      </button>
    </div>
  );
}
