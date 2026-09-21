import { and, asc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db/client";
import {
  attribute,
  attributeValue,
  category,
  product,
  productAttributeValue,
  productCategory,
  productImage,
  productVariant,
} from "@/db/schema/catalogue";
import { taxRate } from "@/db/schema/settings";
import { ProductForm } from "../_components/product-form";
import { ImagesEditor } from "../_components/images-editor";
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

  const [categories, taxRates, colours, productCats, variantRows, imageRows] =
    await Promise.all([
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
      db
        .select({ categoryId: productCategory.categoryId })
        .from(productCategory)
        .where(eq(productCategory.productId, id)),
      db
        .select()
        .from(productVariant)
        .where(eq(productVariant.productId, id))
        .orderBy(asc(productVariant.sortOrder), asc(productVariant.id)),
      db
        .select({
          id: productImage.id,
          url: productImage.url,
          altDe: productImage.altDe,
          variantId: productImage.variantId,
          width: productImage.width,
          height: productImage.height,
        })
        .from(productImage)
        .where(eq(productImage.productId, id))
        .orderBy(asc(productImage.sortOrder), asc(productImage.id)),
    ]);

  // Selected colour IDs for this product - scoped to only the colour
  // attribute's values so future attributes don't leak into this list.
  const colourIds = colours.map((c) => c.id);
  const selectedColourRows =
    colourIds.length === 0
      ? []
      : await db
          .select({
            attributeValueId: productAttributeValue.attributeValueId,
          })
          .from(productAttributeValue)
          .where(
            and(
              eq(productAttributeValue.productId, id),
              inArray(productAttributeValue.attributeValueId, colourIds),
            ),
          );
  const selectedColourIds = selectedColourRows.map((r) => r.attributeValueId);

  const selectedCategoryIds = productCats.map((r) => r.categoryId);
  const initialVariants = variantRows.map((v) => ({
    id: v.id,
    sizeLabelDe: v.sizeLabelDe ?? "",
    priceGross: v.priceGross,
    salePriceGross: v.salePriceGross ?? "",
    isAvailable: v.isAvailable,
    minQuantity: String(v.minQuantity),
    maxQuantity: v.maxQuantity == null ? "" : String(v.maxQuantity),
    sortOrder: String(v.sortOrder),
  }));
  const updateWithId = updateProduct.bind(null, id);

  // Variant labels for the image → variant assignment dropdown.
  // Format: "Klein — 35.00 CHF" or "— 35.00 CHF" if the variant has no label.
  const variantOptions = variantRows.map((v) => ({
    id: v.id,
    label: v.sizeLabelDe
      ? `${v.sizeLabelDe} — ${v.priceGross} CHF`
      : `— ${v.priceGross} CHF`,
  }));

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
        colours={colours}
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
        selectedColourIds={selectedColourIds}
        initialVariants={initialVariants}
        action={updateWithId}
        submitLabel="Speichern"
      />

      {/* Images live OUTSIDE the ProductForm on purpose: uploads persist
          immediately via their own Server Actions rather than waiting for
          the product form's Save button. That way an interrupted session
          doesn't lose the photos. */}
      <section className="space-y-4 pt-4 border-t max-w-3xl">
        <div>
          <h2 className="text-lg font-medium">Bilder</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Reihenfolge bestimmt Anzeige im Shop. Erstes Bild ist das
            Hauptbild. Variant-Zuweisung optional - ohne Auswahl gilt das
            Bild fürs ganze Produkt.
          </p>
        </div>
        <ImagesEditor
          productId={id}
          images={imageRows}
          variants={variantOptions}
        />
      </section>
    </div>
  );
}
