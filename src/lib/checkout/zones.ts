import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { deliveryZone, deliveryZonePlz } from "@/db/schema/delivery";
import type {
  PlzLookupResult,
  ResolvedZone,
} from "./types";

/**
 * PLZ resolution.
 *
 * The lookup is keyed on (plz, ortschaft) - not plz alone. PLZ 5415
 * covers TWO Ortschaften with different fees (Nussbaumen CHF 12,
 * Rieden CHF 14). A single PLZ therefore cannot determine the price.
 *
 * Lookup contract:
 *   0 rows -> "wir liefern leider nicht an diese Adresse"
 *   1 row  -> use it directly
 *   2+ rows -> show the Ortschaft picker
 */
export async function lookupPlz(plz: string): Promise<PlzLookupResult> {
  const clean = plz.trim();
  if (!/^\d{4}$/.test(clean)) {
    return { kind: "none" };
  }

  const rows = await db
    .select({
      zoneId: deliveryZone.id,
      zoneNameDe: deliveryZone.nameDe,
      ortschaft: deliveryZonePlz.ortschaft,
      plz: deliveryZonePlz.plz,
      feeGross: deliveryZone.feeGross,
      minOrderGross: deliveryZone.minOrderGross,
      freeOverGross: deliveryZone.freeOverGross,
      isActive: deliveryZone.isActive,
    })
    .from(deliveryZonePlz)
    .innerJoin(deliveryZone, eq(deliveryZone.id, deliveryZonePlz.zoneId))
    .where(eq(deliveryZonePlz.plz, clean));

  const active = rows.filter((r) => r.isActive);
  if (active.length === 0) return { kind: "none" };

  if (active.length === 1) {
    const r = active[0];
    return {
      kind: "single",
      zone: {
        zoneId: r.zoneId,
        zoneNameDe: r.zoneNameDe,
        ortschaft: r.ortschaft,
        plz: r.plz,
        feeGross: r.feeGross,
        minOrderGross: r.minOrderGross,
        freeOverGross: r.freeOverGross,
      },
    };
  }

  return {
    kind: "picker",
    options: active.map((r) => ({
      ortschaft: r.ortschaft,
      zoneId: r.zoneId,
      zoneNameDe: r.zoneNameDe,
      feeGross: r.feeGross,
      minOrderGross: r.minOrderGross,
    })),
  };
}

/**
 * Resolve a specific (plz, ortschaft) tuple back to a full zone row.
 * Used when the customer has already picked an Ortschaft and we need
 * the zone details for the next step, or at reserve time.
 *
 * Returns null if the row doesn't exist (customer edited the cookie).
 */
export async function resolveZoneByPlzOrtschaft(
  plz: string,
  ortschaft: string,
): Promise<ResolvedZone | null> {
  const [row] = await db
    .select({
      zoneId: deliveryZone.id,
      zoneNameDe: deliveryZone.nameDe,
      ortschaft: deliveryZonePlz.ortschaft,
      plz: deliveryZonePlz.plz,
      feeGross: deliveryZone.feeGross,
      minOrderGross: deliveryZone.minOrderGross,
      freeOverGross: deliveryZone.freeOverGross,
      isActive: deliveryZone.isActive,
    })
    .from(deliveryZonePlz)
    .innerJoin(deliveryZone, eq(deliveryZone.id, deliveryZonePlz.zoneId))
    .where(
      and(
        eq(deliveryZonePlz.plz, plz),
        eq(deliveryZonePlz.ortschaft, ortschaft),
      ),
    )
    .limit(1);

  if (!row || !row.isActive) return null;

  return {
    zoneId: row.zoneId,
    zoneNameDe: row.zoneNameDe,
    ortschaft: row.ortschaft,
    plz: row.plz,
    feeGross: row.feeGross,
    minOrderGross: row.minOrderGross,
    freeOverGross: row.freeOverGross,
  };
}
