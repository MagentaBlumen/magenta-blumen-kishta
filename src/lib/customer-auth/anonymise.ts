import "server-only";
import { eq, sql } from "drizzle-orm";
import { db as defaultDb } from "@/db/client";
import { customer, customerAddress } from "@/db/schema/customer";

/**
 * revFADP erasure for a customer row.
 *
 * Nulls the live personal fields and stamps `anonymised_at`. Replaces
 * the password hash with a lockout string that can never match a real
 * bcrypt comparison (`$2b$…` has a specific shape — this does not), so
 * the row cannot be used to log in again even if `anonymised_at` is
 * later cleared by hand.
 *
 * Addresses (`customer_address`) are the customer's own address book —
 * not referenced by any order (rule 1: orders snapshot addresses, they
 * never reference them). DELETE here is safe and necessary: an
 * untouched address book would leave the recipient's name + street
 * reachable via the anonymised row.
 *
 * Orders are NOT touched. Every order carries its own snapshot of the
 * buyer name / email / phone and the delivery address at the moment of
 * checkout (schema rule 1), and Swiss accounting law requires
 * ten-year retention of business records (CLAUDE.md rule 10). A
 * post-anonymisation `SELECT total_gross, buyer_name, delivery_street
 * FROM "order"` for this customer must return identical values.
 *
 * All writes run in one transaction so a mid-way error leaves the
 * state fully pre-anonymisation.
 */

export type AnonymiseResult = {
  /** `false` when no customer row with that id exists. */
  found: boolean;
  /** Number of `customer_address` rows deleted. */
  addressesDeleted: number;
  /**
   * Pre-anonymisation email + name, captured inside the tx so the
   * caller can send the FADP farewell mail after commit. `null` when:
   *   - the customer was not found, OR
   *   - the row was already anonymised (so the live email is already
   *     `anonymised-<id>@local.invalid` and re-sending the farewell
   *     is wrong).
   */
  snapshot: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

type DbClient = typeof defaultDb;

export async function anonymiseCustomer(
  customerId: number,
  dbClient: DbClient = defaultDb,
): Promise<AnonymiseResult> {
  return dbClient.transaction<AnonymiseResult>(async (tx) => {
    // Capture the pre-anonymisation personal fields FIRST — once the
    // UPDATE below runs, the live row is already anonymised and the
    // real email is gone. The caller needs it for the farewell mail.
    const [before] = await tx
      .select({
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        anonymisedAt: customer.anonymisedAt,
      })
      .from(customer)
      .where(eq(customer.id, customerId))
      .limit(1);

    if (!before) {
      return { found: false, addressesDeleted: 0, snapshot: null };
    }

    // If already anonymised, do not re-send the farewell mail; return
    // found but with a null snapshot so the caller skips the send.
    // The DB write below is a no-op in that case, but keeps the
    // transaction shape consistent (and bumps anonymised_at if some
    // future code wanted to track re-attempts).
    const alreadyAnonymised = before.anonymisedAt !== null;

    const updated = await tx
      .update(customer)
      .set({
        email: sql`concat('anonymised-', ${customer.id}, '@local.invalid')`,
        firstName: null,
        lastName: null,
        phone: null,
        passwordHash: "ANONYMISED-NO-LOGIN",
        anonymisedAt: new Date(),
      })
      .where(eq(customer.id, customerId))
      .returning({ id: customer.id });

    if (updated.length === 0) {
      return { found: false, addressesDeleted: 0, snapshot: null };
    }

    const deletedAddresses = await tx
      .delete(customerAddress)
      .where(eq(customerAddress.customerId, customerId))
      .returning({ id: customerAddress.id });

    return {
      found: true,
      addressesDeleted: deletedAddresses.length,
      snapshot: alreadyAnonymised
        ? null
        : {
            email: before.email,
            firstName: before.firstName,
            lastName: before.lastName,
          },
    };
  });
}
