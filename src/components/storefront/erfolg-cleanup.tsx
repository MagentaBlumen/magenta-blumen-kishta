"use client";

import { useEffect, useRef } from "react";
import { clearCheckoutCookiesAction } from "@/lib/checkout/actions";

/**
 * Fires once on mount to clear cart + checkout cookies after a
 * successful payment. For cash/invoice reserveOrderAction already
 * cleared them server-side; for card/twint it had to leave them in
 * place (if cleared early, the Bestätigen page server-redirects to
 * /warenkorb before the Payment Element can mount).
 *
 * Idempotent on the server, so firing for cash/invoice flows too is
 * harmless.
 */
export function ErfolgCleanup() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    clearCheckoutCookiesAction().catch(() => {
      // Server-side failure logs itself; nothing for us to show.
    });
  }, []);
  return null;
}
