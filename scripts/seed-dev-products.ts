/**
 * One-off seed: 15 placeholder products so the storefront has content
 * to render while Sandra hasn't entered her real catalogue yet.
 *
 * Every slug is prefixed `dev-`, so bulk delete later is one line:
 *
 *   DELETE FROM product WHERE slug LIKE 'dev-%';
 *
 * Cascades handle product_category / product_variant /
 * product_attribute_value (all `ON DELETE cascade` in schema).
 * product_image is also cascade so any photos Sandra attached will
 * go too - make sure to note which ones are hers before deleting.
 *
 * Run locally:
 *   npm run db:up               (make sure postgres is running)
 *   npx tsx scripts/seed-dev-products.ts
 *
 * Run against prod (BE CAREFUL):
 *   DATABASE_URL=postgres://... npx tsx scripts/seed-dev-products.ts
 *
 * Idempotent: skips products whose slug already exists.
 */

import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  attribute,
  attributeValue,
  category,
  product,
  productAttributeValue,
  productCategory,
  productVariant,
} from "../src/db/schema/catalogue";
import { taxRate } from "../src/db/schema/settings";

type PricingMode = "variant" | "per_unit" | "enquiry";
type TaxCode = "reduced" | "standard";

type SeedProduct = {
  slug: string;
  nameDe: string;
  descriptionDe: string;
  pricingMode: PricingMode;
  taxCode: TaxCode;
  categorySlugs: string[];
  colourValues: string[];
  variants: Array<{
    sizeLabelDe: string | null;
    priceGross: string;
  }>;
};

// Prices reflect the owner's price sheet. Bouquets 40-120 CHF band.
// Per-stem cut flowers 4-5 CHF. Arrangements 60-100 CHF.
const PRODUCTS: SeedProduct[] = [
  {
    slug: "dev-rosenstrauss-rot",
    nameDe: "Rosenstrauss Rot",
    descriptionDe:
      "Klassisch, romantisch, unmissverständlich. Rote Rosen mit passendem Grün, handgebunden.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["rosen", "blumenstraeusse", "liebe", "valentinstag"],
    colourValues: ["rot"],
    variants: [
      { sizeLabelDe: "Klein (12 Stiele)", priceGross: "45.00" },
      { sizeLabelDe: "Mittel (24 Stiele)", priceGross: "75.00" },
      { sizeLabelDe: "Gross (36 Stiele)", priceGross: "110.00" },
    ],
  },
  {
    slug: "dev-blumenstrauss-bunt",
    nameDe: "Blumenstrauss Bunt",
    descriptionDe:
      "Saisonale Blumen in bunter Mischung. Passt zu fast jedem Anlass.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["blumenstraeusse", "geburtstag", "alle-anlaesse"],
    colourValues: ["bunt"],
    variants: [
      { sizeLabelDe: "Klein", priceGross: "40.00" },
      { sizeLabelDe: "Mittel", priceGross: "65.00" },
      { sizeLabelDe: "Gross", priceGross: "95.00" },
    ],
  },
  {
    slug: "dev-fruehlingsstrauss",
    nameDe: "Frühlingsstrauss",
    descriptionDe:
      "Tulpen, Narzissen und Anemonen — das Beste der Saison.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["blumenstraeusse", "fruehling", "geburtstag"],
    colourValues: ["bunt", "gelb"],
    variants: [
      { sizeLabelDe: "Klein", priceGross: "42.00" },
      { sizeLabelDe: "Mittel", priceGross: "68.00" },
    ],
  },
  {
    slug: "dev-rose-schnittblume",
    nameDe: "Rose (Schnittblume)",
    descriptionDe:
      "Einzelne rote Rose, Länge ca. 50 cm. Verkauf per Stiel.",
    pricingMode: "per_unit",
    taxCode: "reduced",
    categorySlugs: ["rosen", "schnittblumen", "liebe"],
    colourValues: ["rot"],
    variants: [{ sizeLabelDe: null, priceGross: "4.50" }],
  },
  {
    slug: "dev-weisser-trauerstrauss",
    nameDe: "Weisser Trauerstrauss",
    descriptionDe:
      "Weisse Rosen, Lilien und Grün. Klassisch für Abdankung oder Kondolenz.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["blumenstraeusse", "trauer"],
    colourValues: ["weiss-creme"],
    variants: [
      { sizeLabelDe: "Klein", priceGross: "60.00" },
      { sizeLabelDe: "Mittel", priceGross: "95.00" },
    ],
  },
  {
    slug: "dev-zimmerorchidee-weiss",
    nameDe: "Zimmerorchidee Weiss",
    descriptionDe:
      "Phalaenopsis in weissem Übertopf. Blüht bei richtiger Pflege monatelang.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["orchideen", "zimmerpflanzen", "danke", "einweihung"],
    colourValues: ["weiss-creme"],
    variants: [{ sizeLabelDe: "Standard", priceGross: "55.00" }],
  },
  {
    slug: "dev-gerbera-bunt",
    nameDe: "Gerbera Bunt (Schnittblume)",
    descriptionDe: "Bunte Gerbera per Stiel. Halten 7-10 Tage in der Vase.",
    pricingMode: "per_unit",
    taxCode: "reduced",
    categorySlugs: ["schnittblumen", "geburtstag"],
    colourValues: ["bunt"],
    variants: [{ sizeLabelDe: null, priceGross: "5.00" }],
  },
  {
    slug: "dev-sommerstrauss",
    nameDe: "Sommerstrauss",
    descriptionDe:
      "Sonnenblumen, Zinnien und Kornblumen — warme Sommerfarben.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["blumenstraeusse", "sommer"],
    colourValues: ["gelb", "orange-lachs"],
    variants: [
      { sizeLabelDe: "Klein", priceGross: "48.00" },
      { sizeLabelDe: "Mittel", priceGross: "75.00" },
    ],
  },
  {
    slug: "dev-grabgesteck-klassisch",
    nameDe: "Grabgesteck Klassisch",
    descriptionDe:
      "Herbstliches Gesteck aus Chrysanthemen und Efeu, in Grabschale.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["gestecke", "trauer", "allerheiligen"],
    colourValues: ["weiss-creme"],
    variants: [{ sizeLabelDe: "Standard", priceGross: "75.00" }],
  },
  {
    slug: "dev-ficus-zimmerpflanze",
    nameDe: "Ficus Zimmerpflanze",
    descriptionDe:
      "Ficus benjamina im Naturtopf. Pflegeleicht, mag hellen Standort.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["zimmerpflanzen", "einweihung"],
    colourValues: ["gruen"],
    variants: [
      { sizeLabelDe: "Klein (30 cm)", priceGross: "28.00" },
      { sizeLabelDe: "Gross (80 cm)", priceGross: "58.00" },
    ],
  },
  {
    slug: "dev-herbstgesteck",
    nameDe: "Herbstgesteck",
    descriptionDe:
      "Kürbisse, Beeren und Zweige in warmen Herbsttönen. Für Tisch oder Fenster.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["gestecke", "herbst", "danke"],
    colourValues: ["orange-lachs"],
    variants: [{ sizeLabelDe: "Standard", priceGross: "65.00" }],
  },
  {
    slug: "dev-weihnachtsstrauss",
    nameDe: "Weihnachtsstrauss",
    descriptionDe:
      "Rote Amaryllis, Tannenzweige und goldene Akzente.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["blumenstraeusse", "weihnachten"],
    colourValues: ["rot", "gruen"],
    variants: [
      { sizeLabelDe: "Klein", priceGross: "55.00" },
      { sizeLabelDe: "Mittel", priceGross: "85.00" },
    ],
  },
  {
    slug: "dev-muttertagsstrauss-rosa",
    nameDe: "Muttertagsstrauss Rosa",
    descriptionDe:
      "Rosa Rosen, Pfingstrosen und Eukalyptus. Klassisch und liebevoll.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["blumenstraeusse", "muttertag"],
    colourValues: ["rosa-pink"],
    variants: [
      { sizeLabelDe: "Klein", priceGross: "50.00" },
      { sizeLabelDe: "Mittel", priceGross: "78.00" },
    ],
  },
  {
    slug: "dev-osterstrauss",
    nameDe: "Osterstrauss",
    descriptionDe:
      "Tulpen, Weidenkätzchen und Osterglocken in Pastellfarben.",
    pricingMode: "variant",
    taxCode: "reduced",
    categorySlugs: ["blumenstraeusse", "ostern"],
    colourValues: ["gelb", "pastell"],
    variants: [
      { sizeLabelDe: "Klein", priceGross: "42.00" },
      { sizeLabelDe: "Mittel", priceGross: "62.00" },
    ],
  },
  {
    slug: "dev-trockenblumenstrauss",
    nameDe: "Trockenblumenstrauss",
    descriptionDe:
      "Pastellfarbene Trockenblumen — hält monatelang, kein Wasserwechsel nötig.",
    pricingMode: "variant",
    taxCode: "standard", // dried flowers - 8.1% per docs/vat-rates.md
    categorySlugs: ["trockenblumen", "danke", "einweihung"],
    colourValues: ["pastell"],
    variants: [
      { sizeLabelDe: "Klein", priceGross: "38.00" },
      { sizeLabelDe: "Mittel", priceGross: "58.00" },
    ],
  },
];

async function main() {
  // -------- Lookup helpers --------
  const categories = await db.select().from(category);
  const catBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  const colours = await db
    .select({ id: attributeValue.id, value: attributeValue.value })
    .from(attributeValue)
    .innerJoin(attribute, eq(attribute.id, attributeValue.attributeId))
    .where(eq(attribute.key, "colour"));
  const colourByValue = new Map(colours.map((c) => [c.value, c.id]));

  const taxRates = await db.select().from(taxRate);
  const taxByCode = new Map(taxRates.map((t) => [t.code, t.id]));

  // -------- Seed --------
  let inserted = 0;
  let skipped = 0;

  for (const p of PRODUCTS) {
    const [existing] = await db
      .select({ id: product.id })
      .from(product)
      .where(eq(product.slug, p.slug))
      .limit(1);

    if (existing) {
      console.log(`  skip  ${p.slug} (already exists)`);
      skipped++;
      continue;
    }

    const taxRateId = taxByCode.get(p.taxCode);
    if (!taxRateId) {
      throw new Error(`Tax code ${p.taxCode} not seeded`);
    }

    await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(product)
        .values({
          slug: p.slug,
          nameDe: p.nameDe,
          descriptionDe: p.descriptionDe,
          pricingMode: p.pricingMode,
          taxRateId,
          isAvailable: true,
          isOnlineOrderable: true,
          isAddon: false,
          isArchived: false,
          leadTimeDays: 0,
          sortOrder: 0,
        })
        .returning({ id: product.id });

      // Categories
      const catIds = p.categorySlugs
        .map((s) => catBySlug.get(s))
        .filter((id): id is number => id !== undefined);
      if (catIds.length > 0) {
        await tx.insert(productCategory).values(
          catIds.map((cid) => ({ productId: row.id, categoryId: cid })),
        );
      }

      // Colours
      const colourIds = p.colourValues
        .map((v) => colourByValue.get(v))
        .filter((id): id is number => id !== undefined);
      if (colourIds.length > 0) {
        await tx.insert(productAttributeValue).values(
          colourIds.map((avid) => ({
            productId: row.id,
            attributeValueId: avid,
          })),
        );
      }

      // Variants
      await tx.insert(productVariant).values(
        p.variants.map((v, i) => ({
          productId: row.id,
          sizeLabelDe: v.sizeLabelDe,
          priceGross: v.priceGross,
          isAvailable: true,
          minQuantity: 1,
          maxQuantity: null,
          sortOrder: i,
        })),
      );
    });

    console.log(`  ok    ${p.slug}`);
    inserted++;
  }

  console.log("");
  console.log(`Inserted ${inserted}, skipped ${skipped} of ${PRODUCTS.length}.`);
  console.log("");
  console.log("Delete later with:");
  console.log("  DELETE FROM product WHERE slug LIKE 'dev-%';");
  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
