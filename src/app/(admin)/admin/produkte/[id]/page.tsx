import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import { category, product, productCategory } from "@/db/schema/catalogue";
import { taxRate } from "@/db/schema/settings";
import { ProductForm } from "../_components/product-form";
import { updateProduct } from "../actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: PageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const [productRow] = await db
    .select()
    .from(product)
    .where(eq(product.id, id))
    .limit(1);

  if (!productRow) notFound();

  const [categories, taxRates, productCats] = await Promise.all([
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
      .select({ categoryId: productCategory.categoryId })
      .from(productCategory)
      .where(eq(productCategory.productId, id)),
  ]);

  const selectedCategoryIds = productCats.map((r) => r.categoryId);
  const updateWithId = updateProduct.bind(null, id);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-muted-foreground">
          <Link href="/admin/produkte" className="hover:underline">
            Produkte
          </Link>
          {" / "}
          <span>{productRow.nameDe}</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">
          {productRow.nameDe}
        </h1>
      </div>

      <ProductForm
        categories={categories}
        taxRates={taxRates}
        product={{
          id: productRow.id,
          slug: productRow.slug,
          nameDe: productRow.nameDe,
          descriptionDe: productRow.descriptionDe,
          pricingMode: productRow.pricingMode,
          taxRateId: productRow.taxRateId,
          isAvailable: productRow.isAvailable,
          isOnlineOrderable: productRow.isOnlineOrderable,
          isAddon: productRow.isAddon,
          isArchived: productRow.isArchived,
          leadTimeDays: productRow.leadTimeDays,
          sortOrder: productRow.sortOrder,
        }}
        selectedCategoryIds={selectedCategoryIds}
        action={updateWithId}
        submitLabel="Speichern"
      />
    </div>
  );
}
