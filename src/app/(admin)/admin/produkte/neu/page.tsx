import { asc } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { category } from "@/db/schema/catalogue";
import { taxRate } from "@/db/schema/settings";
import { ProductForm } from "../_components/product-form";
import { createProduct } from "../actions";

export default async function NewProductPage() {
  const [categories, taxRates] = await Promise.all([
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

      <ProductForm
        categories={categories}
        taxRates={taxRates}
        action={createProduct}
        submitLabel="Anlegen"
      />
    </div>
  );
}
