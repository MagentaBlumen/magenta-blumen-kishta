"use client";

import { useState, useTransition } from "react";
import {
  ALL_STATUSES,
  allowedNextStatuses,
  type OrderStatus,
} from "@/lib/admin/order-status";
import { updateOrderStatusAction } from "../actions";

/**
 * Pill-row of order-status buttons. Current status is highlighted.
 * Invalid transitions are disabled. Clicking a valid target fires
 * the server action which re-validates against the fresh DB state.
 *
 * Shows all 8 states so Sandra sees the full flow at a glance;
 * clearer than hiding and matches the paper Bon's status log.
 */

const LABELS: Record<OrderStatus, string> = {
  new: "Neu",
  confirmed: "Bestätigt",
  in_production: "In Produktion",
  ready: "Fertig",
  out_for_delivery: "Unterwegs",
  delivered: "Geliefert",
  delivery_failed: "Fehlgeschlagen",
  cancelled: "Storniert",
};

export function StatusButtons({
  orderNumber,
  current,
}: {
  orderNumber: string;
  current: OrderStatus;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingTarget, setPendingTarget] = useState<OrderStatus | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextAllowed = new Set(allowedNextStatuses(current));

  function pick(target: OrderStatus) {
    if (target === current) return;
    if (!nextAllowed.has(target)) return;
    setError(null);
    setPendingTarget(target);
    startTransition(async () => {
      try {
        await updateOrderStatusAction(orderNumber, target);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      } finally {
        setPendingTarget(null);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {ALL_STATUSES.map((s) => {
          const isCurrent = s === current;
          const isAllowed = nextAllowed.has(s);
          const isLoading = isPending && pendingTarget === s;

          const base =
            "inline-flex items-center justify-center h-8 px-3 text-xs font-medium border rounded-md transition-colors";

          let className: string;
          if (isCurrent) {
            className = `${base} border-foreground bg-foreground text-background cursor-default`;
          } else if (isAllowed) {
            className = `${base} border-input bg-background text-foreground hover:bg-muted cursor-pointer`;
          } else {
            className = `${base} border-input bg-background text-muted-foreground/40 cursor-not-allowed`;
          }

          return (
            <button
              key={s}
              type="button"
              onClick={() => pick(s)}
              disabled={isCurrent || !isAllowed || isPending}
              aria-pressed={isCurrent}
              className={className}
            >
              {isLoading ? "…" : LABELS[s]}
            </button>
          );
        })}
      </div>
      {error && (
        <p className="text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}
