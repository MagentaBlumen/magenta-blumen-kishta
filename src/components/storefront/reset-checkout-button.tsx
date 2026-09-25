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
      className="inline-block px-3 py-1 border border-rose text-rose text-[0.65rem] tracking-[0.1em] uppercase font-medium hover:bg-rose hover:text-ivory transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
