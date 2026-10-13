import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";

/**
 * Compact profile snapshot used to PREFILL checkout fields for a
 * logged-in customer. Cookie values still win over profile - this is
 * only consulted when a given cookie field is empty, so a customer who
 * is buying for someone else can type a different buyer name without
 * fighting the auto-fill.
 */
export type CustomerPrefill = {
  name: string;
  email: string;
  phone: string | null;
};

export async function fetchCustomerPrefill(
  customerId: number,
): Promise<CustomerPrefill | null> {
  const [row] = await db
    .select({
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      phone: customer.phone,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customer)
    .where(eq(customer.id, customerId))
    .limit(1);

  if (!row) return null;
  if (row.anonymisedAt) return null; // defensive, authorize already blocks this

  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  return {
    name: name || row.email,
    email: row.email,
    phone: row.phone ?? null,
  };
}
