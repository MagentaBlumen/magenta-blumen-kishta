// NOT server-only: this file is pure constants + pure functions and
// is intentionally imported by both the server action and the client
// StatusButtons component so they share one source of truth for the
// state machine.

/**
 * Order status transition rules, from docs/checkout-transaction.md §1:
 *
 *   new  ->  confirmed  ->  in_production  ->  ready  ->  out_for_delivery  ->  delivered
 *                                                ^                              |
 *                                                |                              v
 *                                                +------------  delivery_failed
 *   cancelled  <-  (from any state before out_for_delivery)
 *
 * Codified here so both the UI and the server action can use the
 * same source of truth. Server action re-checks against the CURRENT
 * DB status, not what the UI thought was current - a stale tab
 * clicking "mark delivered" on an already-cancelled order must fail.
 */

export type OrderStatus =
  | "new"
  | "confirmed"
  | "in_production"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "delivery_failed"
  | "cancelled";

export const ALL_STATUSES: readonly OrderStatus[] = [
  "new",
  "confirmed",
  "in_production",
  "ready",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "cancelled",
] as const;

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["in_production", "cancelled"],
  in_production: ["ready", "cancelled"],
  ready: ["out_for_delivery", "delivery_failed", "cancelled"],
  out_for_delivery: ["delivered", "delivery_failed"],
  // delivery_failed loops back to ready after Sandra reassigns the
  // run (reassignment UI will come later; the status flip is enough
  // for now - delivery_date / sort_time stay on the old run until
  // she rebooks).
  delivery_failed: ["ready", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function isValidTransition(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return ALLOWED[from]?.includes(to) ?? false;
}

export function allowedNextStatuses(from: OrderStatus): OrderStatus[] {
  return ALLOWED[from] ?? [];
}
