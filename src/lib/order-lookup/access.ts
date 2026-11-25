import type { Session } from "next-auth";

/**
 * Who may view `/bestellung-finden/[number]` for an order whose
 * `customer_id` is `orderCustomerId`.
 *
 *   - a valid HMAC cookie bound to this order number (`hasToken`), OR
 *   - a logged-in customer whose session customerId equals the order's.
 *
 * Any other combination returns false, and the page must `notFound()`.
 * Extracted so the isolation tests can exercise the real predicate.
 */
export function canSeeOrderView(
  session: Session | null,
  orderCustomerId: number | null,
  hasToken: boolean,
): boolean {
  if (hasToken) return true;
  return (
    session?.user?.role === "customer" &&
    session.user.customerId != null &&
    orderCustomerId != null &&
    orderCustomerId === session.user.customerId
  );
}
