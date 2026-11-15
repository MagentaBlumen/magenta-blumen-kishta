"use client";

import { useTransition } from "react";
import { resetCheckoutAction } from "@/lib/checkout/actions";

// Small "Ändern" link that clears the checkout cookie so the customer
// can pick a new PLZ / zone. Sits inside the resolved-zone card.
export function ResetCheckoutButton({ label = "Ändern" }: { label?: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => resetCheckoutAction())}
      className="text-[13px] underline text-sage hover:text-rose transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
