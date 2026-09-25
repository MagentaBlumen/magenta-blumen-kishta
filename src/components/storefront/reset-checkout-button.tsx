"use client";

import { useTransition } from "react";
import { resetCheckoutAction } from "@/lib/checkout/actions";

/**
 * Small "ändern" link that clears the checkout cookie so the customer
 * can pick a new PLZ / zone. Lives on the resolved-zone card.
 */
export function ResetCheckoutButton({ label = "Ändern" }: { label?: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => resetCheckoutAction())}
      className="text-[0.7rem] tracking-[0.08em] uppercase text-sage hover:text-rose transition-colors disabled:opacity-30"
    >
      {label}
    </button>
  );
}
