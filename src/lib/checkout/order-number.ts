import "server-only";
import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";

/**
 * Human-friendly order number: `MB-YYYYMMDD-XXXXXXXX`.
 *
 * The date is Europe/Zurich so the number matches when the customer
 * placed the order in her time, not UTC. The random suffix is 4 bytes
 * (32 bits) hex uppercased - collision odds within one day are 1 in
 * ~4 billion; the UNIQUE constraint on order_number catches the rest.
 *
 * Chosen over a Postgres sequence because it's readable ('call me
 * about order 20260925-A3F9E7B2' works over the phone) and because
 * adding a sequence would need a schema change that isn't worth it.
 */
export function generateOrderNumber(): string {
  const day = DateTime.now().setZone("Europe/Zurich").toFormat("yyyyLLdd");
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `MB-${day}-${suffix}`;
}
