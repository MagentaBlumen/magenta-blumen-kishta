/**
 * Counterpart to seed-dev-products.ts. Deletes exactly what that seed
 * creates — rows whose `product.slug LIKE 'dev-%'` — and nothing else.
 *
 * Refuses to run without an explicit confirmation flag. Prints what
 * it would delete BEFORE deleting, so a dry run is just leaving the
 * flag off:
 *
 *   # Dry run — list, do not delete.
 *   npx tsx scripts/delete-dev-products.ts
 *
 *   # Actual delete.
 *   npx tsx scripts/delete-dev-products.ts --yes
 *
 * Cascades handle product_category / product_variant /
 * product_attribute_value / product_image (all `ON DELETE cascade`
 * in schema). Any images that got attached to a dev product will be
 * removed from the DB — the files in R2 are not touched here; clean
 * those up through the admin UI before running this if they matter.
 *
 * DO NOT run against the production database. Seed data must be
 * cleaned from prod as a deliberate human step, not from this box.
 */

import { like, sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { product } from "../src/db/schema/catalogue";

const SLUG_PREFIX = "dev-";
const CONFIRM_FLAG = "--yes";

function parseArgs(argv: string[]): { confirm: boolean } {
  return {
    confirm: argv.includes(CONFIRM_FLAG),
  };
}

async function main(): Promise<void> {
  const { confirm } = parseArgs(process.argv.slice(2));

  const rows = await db
    .select({
      id: product.id,
      slug: product.slug,
      nameDe: product.nameDe,
    })
    .from(product)
    .where(like(product.slug, `${SLUG_PREFIX}%`));

  if (rows.length === 0) {
    console.log(`No products with slug LIKE '${SLUG_PREFIX}%' — nothing to do.`);
    process.exit(0);
  }

  console.log(
    `${rows.length} dev product${rows.length === 1 ? "" : "s"} matched:\n`,
  );
  for (const r of rows) {
    console.log(`  #${r.id.toString().padStart(5)}  ${r.slug.padEnd(40)} ${r.nameDe}`);
  }
  console.log();

  if (!confirm) {
    console.log(
      `Dry run. Re-run with ${CONFIRM_FLAG} to actually delete these rows.`,
    );
    process.exit(0);
  }

  // Scoped DELETE: slug prefix only, nothing else. sql`` with a
  // parameterised string — no concatenation-into-literal.
  const result = await db
    .delete(product)
    .where(like(product.slug, sql`${SLUG_PREFIX + "%"}`))
    .returning({ id: product.id });

  console.log(`Deleted ${result.length} row${result.length === 1 ? "" : "s"}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
