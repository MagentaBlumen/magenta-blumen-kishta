import { and, asc, eq } from "drizzle-orm";
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
import { largeUrl, thumbUrl } from "@/lib/image-urls";
import { formatChf } from "@/lib/money";
import { Badge } from "@/components/ui/badge";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProductDetailPage({ params }: PageProps) {
  const { slug } = await params;

  const [productRow] = await db
    .select()
    .from(product)
    .where(
      and(eq(product.slug, slug), eq(product.isArchived, false)),
    )
    .limit(1);

  if (!productRow) notFound();

  const [variants, images, colours, categories] = await Promise.all([
    db
      .select()
      .from(productVariant)
      .where(eq(productVariant.productId, productRow.id))
      .orderBy(asc(productVariant.sortOrder), asc(productVariant.id)),
    db
      .select()
      .from(productImage)
      .where(eq(productImage.productId, productRow.id))
      .orderBy(asc(productImage.sortOrder), asc(productImage.id)),
    db
      .select({
        value: attributeValue.value,
        nameDe: attributeValue.nameDe,
        hex: attributeValue.hex,
      })
      .from(productAttributeValue)
      .innerJoin(
        attributeValue,
        eq(attributeValue.id, productAttributeValue.attributeValueId),
      )
      .innerJoin(attribute, eq(attribute.id, attributeValue.attributeId))
      .where(
        and(
          eq(productAttributeValue.productId, productRow.id),
          eq(attribute.key, "colour"),
        ),
      ),
    db
      .select({
        slug: category.slug,
        nameDe: category.nameDe,
        kind: category.kind,
      })
      .from(category)
      .innerJoin(productCategory, eq(productCategory.categoryId, category.id))
      .where(eq(productCategory.productId, productRow.id)),
  ]);

  const heroImage = images[0] ?? null;
  const galleryImages = images.slice(1);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <nav className="text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">
          Startseite
        </Link>
        {" / "}
        <span>{productRow.nameDe}</span>
      </nav>

      <div className="grid gap-8 md:grid-cols-2">
        {/* -------- Image column -------- */}
        <div className="space-y-3">
          <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
            {heroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={largeUrl(heroImage.url)}
                alt={heroImage.altDe ?? productRow.nameDe}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                Kein Bild
              </div>
            )}
            {!productRow.isAvailable && (
              <div className="absolute top-3 right-3 rounded-md bg-background/90 px-3 py-1 text-sm font-medium">
                Ausverkauft
              </div>
            )}
          </div>

          {galleryImages.length > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {galleryImages.map((img) => (
                <div
                  key={img.id}
                  className="aspect-square rounded-md overflow-hidden bg-muted"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbUrl(img.url)}
                    alt={img.altDe ?? ""}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* -------- Info column -------- */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              {productRow.nameDe}
            </h1>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {categories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/kategorie/${c.slug}`}
                  >
                    <Badge variant="outline">{c.nameDe}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {colours.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Farbe</div>
              <div className="flex flex-wrap gap-2">
                {colours.map((c) => (
                  <div
                    key={c.value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full border border-neutral-300"
                      style={{
                        background:
                          c.hex ??
                          "conic-gradient(from 0deg, #F5F0E6, #E8A0BF, #C1272D, #E8853B, #F2C744, #6A8F4F, #6B5B95, #E4D9E8, #F5F0E6)",
                      }}
                      aria-hidden
                    />
                    {c.nameDe}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing block */}
          <PricingBlock
            pricingMode={productRow.pricingMode}
            variants={variants}
          />

          {productRow.descriptionDe && (
            <div className="pt-4 border-t space-y-2">
              <div className="text-sm font-medium">Beschreibung</div>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {productRow.descriptionDe}
              </p>
            </div>
          )}

          <div className="pt-4 border-t text-xs text-muted-foreground">
            Bestellfunktion wird bald verfügbar sein.
          </div>
        </div>
      </div>
    </div>
  );
}

function PricingBlock({
  pricingMode,
  variants,
}: {
  pricingMode: "variant" | "per_unit" | "enquiry";
  variants: Array<{
    id: number;
    sizeLabelDe: string | null;
    priceGross: string;
    salePriceGross: string | null;
    isAvailable: boolean;
  }>;
}) {
  if (pricingMode === "enquiry") {
    return (
      <div className="rounded-lg border p-4 bg-muted/40">
        <div className="text-sm font-medium">Nur auf Anfrage</div>
        <div className="text-xs text-muted-foreground mt-1">
          Hochzeit, Trauer, Event, Gärtnerservice — bitte kontaktieren Sie
          uns direkt.
        </div>
      </div>
    );
  }

  if (variants.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Zurzeit keine Varianten verfügbar.
      </div>
    );
  }

  if (pricingMode === "per_unit") {
    const v = variants[0];
    return (
      <div className="text-2xl font-semibold tabular-nums">
        {formatChf(v.priceGross)}
        <span className="text-sm text-muted-foreground font-normal ml-2">
          / Stück
        </span>
      </div>
    );
  }

  // variant mode - table of options
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Varianten</div>
      <div className="rounded-lg border divide-y">
        {variants.map((v) => (
          <div
            key={v.id}
            className={`flex items-center justify-between px-4 py-3 ${
              !v.isAvailable ? "opacity-50" : ""
            }`}
          >
            <div className="text-sm">
              {v.sizeLabelDe || "Standard"}
              {!v.isAvailable && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (ausverkauft)
                </span>
              )}
            </div>
            <div className="tabular-nums font-medium">
              {formatChf(v.priceGross)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
