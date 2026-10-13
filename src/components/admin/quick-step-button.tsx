"use client";

import { useState, useTransition } from "react";
import { updateOrderStatusAction } from "@/app/(admin)/admin/bestellung/[number]/actions";
import type { OrderStatus } from "@/lib/admin/order-status";

/**
 * Small inline button on each Heute row firing the single most-likely
 * next-status transition. The full state matrix stays on the detail
 * page for exceptional cases; this button covers the happy path.
 *
 * stopPropagation on both click handlers so clicking the button
 * doesn't trigger the parent <Link> navigation to the detail page.
 */
export function QuickStepButton({
  orderNumber,
  target,
  label,
}: {
  orderNumber: string;
  target: OrderStatus;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setError(null);
    startTransition(async () => {
      try {
        await updateOrderStatusAction(orderNumber, target);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="inline-flex items-center gap-1 h-7 px-2.5 text-[11px] font-medium border border-foreground/80 bg-foreground text-background rounded hover:bg-foreground/85 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        {isPending ? "…" : label}
        {!isPending && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        )}
      </button>
      {error && <span className="text-[10px] text-rose-600 max-w-[160px] text-right">{error}</span>}
    </div>
  );
}
