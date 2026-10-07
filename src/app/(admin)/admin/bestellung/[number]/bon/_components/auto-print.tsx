"use client";

import { useEffect, useRef } from "react";
import { markOrderPrintedAction } from "../../actions";

/**
 * Fires the browser's print dialog on mount, then marks the order
 * as printed. Runs once per mount - useRef guard so React 19 Strict
 * Mode's dev double-mount doesn't send a second print job.
 *
 * window.print() is synchronous-ish: it opens the dialog and returns
 * immediately on all browsers. We don't try to detect whether the
 * user actually clicked "Print" vs "Cancel" - there's no reliable
 * cross-browser API, and over-fire false positives are preferable to
 * under-fire (the indicator just means "we tried to print").
 */
export function AutoPrint({ orderNumber }: { orderNumber: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    // Tiny delay so the layout settles before the print dialog
    // measures the page.
    const t = setTimeout(() => {
      try {
        window.print();
      } catch {
        // Some embedded browsers block window.print(); fall through
        // to the mark-printed call anyway so Sandra sees the ⎙.
      }
      // Fire and forget - don't want a Resend-style silent failure
      // to block the dialog or stop subsequent prints.
      markOrderPrintedAction(orderNumber).catch(() => {
        // Server-side failure logs itself; nothing for us to show
        // here since the user is looking at a print dialog.
      });
    }, 80);

    return () => clearTimeout(t);
  }, [orderNumber]);

  return null;
}
