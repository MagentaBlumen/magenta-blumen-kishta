/**
 * PLZ 5415 - the "two Ortschaften, two prices" case.
 *
 * Verifies delivery_zone_plz is keyed on (plz, ortschaft), NOT plz.
 * PLZ 5415 covers Nussbaumen AG (Zone "Nussbaumen", CHF 12) and
 * Rieden AG (Zone "Rieden bei Nussbaumen", CHF 14) - so a plain
 * postcode lookup can't determine the fee. The lookup must return
 * both and the UI must show an Ortschaft picker.
 *
 * From CLAUDE.md rule 9: "Two rows returned means show an Ortschaft
 * picker."
 *
 * This test reads seeded data (drizzle/seed/02-delivery-zones.sql).
 * Requires the local Postgres to be up and seeded: `docker compose up
 * -d && npm run db:seed` (or however the seed is applied).
 */

import { afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { lookupPlz } from "@/lib/checkout/zones";

const URL_STR =
  process.env.DATABASE_URL ??
  "postgres://magenta:magenta_dev@localhost:5433/magenta_blumen";

// Vitest imports the module-under-test which uses the shared db from
// @/db/client. That client makes its own connection - we don't need
// one here at all except to end() on teardown so vitest exits cleanly.
// But since @/db/client owns its own pool, there is nothing we own to
// close. Kept the shape as a placeholder in case a future test wants
// setup rows.
const adminClient = postgres(URL_STR, { max: 1 });

afterAll(async () => {
  await adminClient.end();
});

describe("PLZ 5415 (Nussbaumen / Rieden)", () => {
  it("returns two Ortschaft options with the correct fees", async () => {
    const result = await lookupPlz("5415");

    expect(result.kind).toBe("picker");
    if (result.kind !== "picker") return; // narrow for TS

    // Should be exactly two rows. If a third appears, either the seed
    // was extended without updating this test or someone added a stray
    // Obersiggenthal row (documented in the seed as intentionally
    // omitted - Obersiggenthal is a Gemeinde, not an Ortschaft).
    expect(result.options).toHaveLength(2);

    const byOrtschaft = new Map(
      result.options.map((o) => [o.ortschaft, o]),
    );

    const nuss = byOrtschaft.get("Nussbaumen AG");
    expect(nuss, "expected a row for Nussbaumen AG").toBeDefined();
    expect(nuss?.feeGross).toBe("12.00");
    expect(nuss?.zoneNameDe).toBe("Nussbaumen");

    const rieden = byOrtschaft.get("Rieden AG");
    expect(rieden, "expected a row for Rieden AG").toBeDefined();
    expect(rieden?.feeGross).toBe("14.00");
    expect(rieden?.zoneNameDe).toBe("Rieden bei Nussbaumen");
  });

  it("returns 'none' for a PLZ we don't serve", async () => {
    const result = await lookupPlz("1000");
    expect(result.kind).toBe("none");
  });

  it("returns a single zone for an unambiguous PLZ (Neuenhof 5432)", async () => {
    const result = await lookupPlz("5432");
    expect(result.kind).toBe("single");
    if (result.kind !== "single") return;
    expect(result.zone.plz).toBe("5432");
    expect(result.zone.ortschaft).toBe("Neuenhof");
    expect(result.zone.feeGross).toBe("8.00");
  });
});
