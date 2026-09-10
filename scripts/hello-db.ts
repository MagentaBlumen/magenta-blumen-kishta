import { asc } from 'drizzle-orm';
import { db } from '../src/db/client';
import { category } from '../src/db/schema/catalogue';

async function main() {
  const rows = await db
    .select({
      slug: category.slug,
      nameDe: category.nameDe,
      kind: category.kind,
      sortOrder: category.sortOrder,
    })
    .from(category)
    .orderBy(asc(category.kind), asc(category.sortOrder));

  console.log(`Read ${rows.length} categories from Postgres:\n`);
  for (const c of rows) {
    console.log(`  [${c.kind}] ${c.sortOrder.toString().padStart(2)}  ${c.slug.padEnd(24)} ${c.nameDe}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
