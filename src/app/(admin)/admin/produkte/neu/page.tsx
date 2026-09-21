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
    <div className="space-y-6">
      <div>
        <div className="text-sm text-muted-foreground">
          <Link href="/admin/produkte" className="hover:underline">
            Produkte
          </Link>
          {" / "}
          <span>Neu</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">
          Neues Produkt
        </h1>
      </div>

      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground max-w-3xl">
        Bilder können nach dem Anlegen hinzugefügt werden.
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
