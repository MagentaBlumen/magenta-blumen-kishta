import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import {
  attribute,
  attributeValue,
  category,
} from "@/db/schema/catalogue";
import { taxRate } from "@/db/schema/settings";
import { ProductForm } from "../_components/product-form";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const [categories, taxRates, colours] = await Promise.all([
    db
      .select({
        id: category.id,
        slug: category.slug,
        nameDe: category.nameDe,
        kind: category.kind,
      })
      .from(category)
      .orderBy(asc(category.kind), asc(category.sortOrder)),
    db
      .select({
        id: taxRate.id,
        code: taxRate.code,
        nameDe: taxRate.nameDe,
      })
      .from(taxRate)
      .orderBy(asc(taxRate.code)),
    db
      .select({
        id: attributeValue.id,
        value: attributeValue.value,
        nameDe: attributeValue.nameDe,
        hex: attributeValue.hex,
      })
      .from(attributeValue)
      .innerJoin(attribute, eq(attribute.id, attributeValue.attributeId))
      .where(eq(attribute.key, "colour"))
      .orderBy(asc(attributeValue.sortOrder)),
  ]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div>
        <Link
          href="/admin/produkte"
          className="text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-rose transition-colors inline-flex items-center gap-1 group"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
            ←
          </span>
          Produkte
        </Link>
        <h1 className="font-display font-light text-[clamp(1.8rem,3vw,2.4rem)] leading-tight mt-2">
          Neues Produkt
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Bilder laden Sie nach dem Anlegen hoch.
        </p>
      </div>

      <ProductForm
        categories={categories}
        taxRates={taxRates}
        colours={colours}
        action={createProduct}
        submitLabel="Anlegen"
      />
    </div>
  );
}
