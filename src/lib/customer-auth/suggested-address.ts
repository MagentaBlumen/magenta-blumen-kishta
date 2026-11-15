import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { order } from "@/db/schema/order";

export type SuggestedAddress = {
  recipientName: string;
  street: string;
  plz: string;
  city: string;
  phone: string | null;
};

type ExistingAddress = { recipientName: string; street: string; plz: string };

// Returns the recipient address from the customer's most recent delivery
// order, but only if it isn't already in their address book. Pickup
// orders (no delivery_street) are skipped.
//
// Matching is case/whitespace-insensitive on name + street and exact on
// PLZ. Caller passes already-fetched addresses so we don't query twice.
export async function getSuggestedAddressFromLastOrder(
  customerId: number,
  existing: ExistingAddress[],
): Promise<SuggestedAddress | null> {
  const [last] = await db
    .select({
      recipientName: order.recipientName,
      street: order.deliveryStreet,
      plz: order.deliveryPlz,
      city: order.deliveryCity,
      phone: order.recipientPhone,
    })
    .from(order)
    .where(
      and(
        eq(order.customerId, customerId),
        isNotNull(order.deliveryStreet),
        isNotNull(order.deliveryPlz),
        isNotNull(order.deliveryCity),
      ),
    )
    .orderBy(desc(order.placedAt))
    .limit(1);

  if (!last?.street || !last.plz || !last.city) return null;

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const alreadySaved = existing.some(
    (a) =>
      norm(a.recipientName) === norm(last.recipientName) &&
      norm(a.street) === norm(last.street!) &&
      a.plz === last.plz,
  );
  if (alreadySaved) return null;

  return {
    recipientName: last.recipientName,
    street: last.street,
    plz: last.plz,
    city: last.city,
    phone: last.phone,
  };
}
