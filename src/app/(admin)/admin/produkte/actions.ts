"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import {
  attribute,
  attributeValue,
  product,
  productAttributeValue,
  productCategory,
  productVariant,
} from "@/db/schema/catalogue";
import { slugify } from "@/lib/slug";

// Server Actions are public endpoints in a URL you can't see - CLAUDE.md
// rule. Every action re-checks auth itself; do not rely on the middleware
// or the (admin) layout gate.
async function requireAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Nicht angemeldet");
  }
}

// -------- form parsing --------
// Deliberately un-fancy for MVP. If a field is malformed we throw with a
// German message; the error boundary shows it. Zod comes when we add
// useActionState-based field-level errors.

type ParsedProductForm = {
  nameDe: string;
  slug: string;
  descriptionDe: string | null;
  pricingMode: "variant" | "per_unit" | "enquiry";
  taxRateId: number | null;
  isAvailable: boolean;
  isOnlineOrderable: boolean;
  isAddon: boolean;
  isArchived: boolean;
  leadTimeDays: number;
  sortOrder: number;
  categoryIds: number[];
  colourIds: number[];
};

function parseProductForm(formData: FormData): ParsedProductForm {
  const nameDe = String(formData.get("nameDe") ?? "").trim();
  if (!nameDe) throw new Error("Name ist erforderlich");

  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = rawSlug || slugify(nameDe);
  if (!slug) throw new Error("Slug konnte nicht generiert werden");

  const pricingMode = String(formData.get("pricingMode") ?? "variant") as
    | "variant"
    | "per_unit"
    | "enquiry";
  if (!["variant", "per_unit", "enquiry"].includes(pricingMode)) {
    throw new Error("Ungültiger Preismodus");
  }

  const taxRateIdRaw = String(formData.get("taxRateId") ?? "").trim();
  const taxRateId = taxRateIdRaw ? Number(taxRateIdRaw) : null;
  if (taxRateId !== null && !Number.isFinite(taxRateId)) {
    throw new Error("Ungültiger MWST-Satz");
  }

  const descriptionRaw = String(formData.get("descriptionDe") ?? "").trim();
  const descriptionDe = descriptionRaw || null;

  return {
    nameDe,
    slug,
    descriptionDe,
    pricingMode,
    taxRateId,
    isAvailable: formData.get("isAvailable") === "on",
    isOnlineOrderable: formData.get("isOnlineOrderable") === "on",
    isAddon: formData.get("isAddon") === "on",
    isArchived: formData.get("isArchived") === "on",
    leadTimeDays: numFromForm(formData, "leadTimeDays", 0),
    sortOrder: numFromForm(formData, "sortOrder", 0),
    categoryIds: formData
      .getAll("categoryIds")
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n)),
    colourIds: formData
      .getAll("colourIds")
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n)),
  };
}

// -------- colour attribute helpers --------
//
// Colour is currently the only attribute we edit through this form.
// Scoping the upsert to `attribute.key = 'colour'` keeps the delete
// safe against future attributes: when we add e.g. 'style', its
// product_attribute_value rows won't be wiped by a colour save.
//
// If several attributes end up editable here, refactor to take the
// attribute key as a parameter.

async function getColourValueIds(
  tx: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<Set<number>> {
  const rows = await tx
    .select({ id: attributeValue.id })
    .from(attributeValue)
    .innerJoin(attribute, eq(attribute.id, attributeValue.attributeId))
    .where(eq(attribute.key, "colour"));
  return new Set(rows.map((r) => r.id));
}

function numFromForm(fd: FormData, name: string, fallback: number): number {
  const raw = String(fd.get(name) ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Ungültige Zahl für ${name}`);
  return n;
}

// -------- variants parsing --------

type VariantInput = {
  id: number | null;
  sizeLabelDe: string | null;
  priceGross: string;          // numeric(10,2) stored as string end-to-end
  salePriceGross: string | null;
  isAvailable: boolean;
  minQuantity: number;
  maxQuantity: number | null;
  sortOrder: number;
};

function parseVariants(formData: FormData): VariantInput[] {
  const raw = String(formData.get("variantsJson") ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Varianten-Daten sind kein gültiges JSON");
  }
  if (!Array.isArray(parsed)) throw new Error("Varianten-Daten sind kein Array");

  return parsed.map((r, idx): VariantInput => {
    if (!r || typeof r !== "object") {
      throw new Error(`Variante ${idx + 1}: ungültig`);
    }
    const row = r as Record<string, unknown>;

    // Price: numeric string. Validate parses to positive float, format to 2dp
    // so the DB gets a normalised numeric-compatible string.
    const priceRaw = String(row.priceGross ?? "").trim();
    if (!priceRaw) throw new Error(`Variante ${idx + 1}: Preis fehlt`);
    const priceNum = Number(priceRaw);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      throw new Error(`Variante ${idx + 1}: Preis muss > 0 sein`);
    }
    const priceGross = priceNum.toFixed(2);

    const saleRaw = String(row.salePriceGross ?? "").trim();
    let salePriceGross: string | null = null;
    if (saleRaw) {
      const saleNum = Number(saleRaw);
      if (!Number.isFinite(saleNum) || saleNum <= 0) {
        throw new Error(`Variante ${idx + 1}: Aktionspreis muss > 0 sein`);
      }
      salePriceGross = saleNum.toFixed(2);
    }

    const minQuantity = Number(row.minQuantity ?? 1);
    if (!Number.isInteger(minQuantity) || minQuantity < 1) {
      throw new Error(`Variante ${idx + 1}: Min. Menge muss >= 1 sein`);
    }
    const maxRaw = String(row.maxQuantity ?? "").trim();
    let maxQuantity: number | null = null;
    if (maxRaw) {
      const m = Number(maxRaw);
      if (!Number.isInteger(m) || m < minQuantity) {
        throw new Error(
          `Variante ${idx + 1}: Max. Menge muss >= Min. Menge sein`,
        );
      }
      maxQuantity = m;
    }

    const sortOrder = Number(row.sortOrder ?? 0);
    if (!Number.isInteger(sortOrder)) {
      throw new Error(`Variante ${idx + 1}: Sortierung muss eine Ganzzahl sein`);
    }

    const idRaw = row.id;
    const id = idRaw === null || idRaw === undefined ? null : Number(idRaw);
    if (id !== null && !Number.isFinite(id)) {
      throw new Error(`Variante ${idx + 1}: ungültige ID`);
    }

    const sizeLabelRaw = String(row.sizeLabelDe ?? "").trim();

    return {
      id,
      sizeLabelDe: sizeLabelRaw || null,
      priceGross,
      salePriceGross,
      isAvailable: Boolean(row.isAvailable),
      minQuantity,
      maxQuantity,
      sortOrder,
    };
  });
}

// -------- create --------

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const values = parseProductForm(formData);
  const variants = parseVariants(formData);

  const inserted = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(product)
      .values({
        slug: values.slug,
        nameDe: values.nameDe,
        descriptionDe: values.descriptionDe,
        pricingMode: values.pricingMode,
        taxRateId: values.taxRateId,
        isAvailable: values.isAvailable,
        isOnlineOrderable: values.isOnlineOrderable,
        isAddon: values.isAddon,
        isArchived: values.isArchived,
        leadTimeDays: values.leadTimeDays,
        sortOrder: values.sortOrder,
      })
      .returning({ id: product.id });

    if (values.categoryIds.length > 0) {
      await tx.insert(productCategory).values(
        values.categoryIds.map((cid) => ({
          productId: row.id,
          categoryId: cid,
        })),
      );
    }

    if (variants.length > 0) {
      await tx.insert(productVariant).values(
        variants.map((v) => ({
          productId: row.id,
          sizeLabelDe: v.sizeLabelDe,
          priceGross: v.priceGross,
          salePriceGross: v.salePriceGross,
          isAvailable: v.isAvailable,
          minQuantity: v.minQuantity,
          maxQuantity: v.maxQuantity,
          sortOrder: v.sortOrder,
        })),
      );
    }

    if (values.colourIds.length > 0) {
      const validColourIds = await getColourValueIds(tx);
      const bad = values.colourIds.filter((id) => !validColourIds.has(id));
      if (bad.length > 0) {
        throw new Error(`Ungültige Farb-IDs: ${bad.join(", ")}`);
      }
      await tx.insert(productAttributeValue).values(
        values.colourIds.map((avId) => ({
          productId: row.id,
          attributeValueId: avId,
        })),
      );
    }

    return row;
  });

  revalidatePath("/admin/produkte");
  redirect(`/admin/produkte/${inserted.id}`);
}

// -------- update --------

export async function updateProduct(id: number, formData: FormData) {
  await requireAdmin();
  const values = parseProductForm(formData);
  const variants = parseVariants(formData);

  await db.transaction(async (tx) => {
    await tx
      .update(product)
      .set({
        slug: values.slug,
        nameDe: values.nameDe,
        descriptionDe: values.descriptionDe,
        pricingMode: values.pricingMode,
        taxRateId: values.taxRateId,
        isAvailable: values.isAvailable,
        isOnlineOrderable: values.isOnlineOrderable,
        isAddon: values.isAddon,
        isArchived: values.isArchived,
        leadTimeDays: values.leadTimeDays,
        sortOrder: values.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(product.id, id));

    // Categories: delete-then-reinsert. Products have ~5 categories in
    // practice; the code stays obvious.
    await tx.delete(productCategory).where(eq(productCategory.productId, id));
    if (values.categoryIds.length > 0) {
      await tx.insert(productCategory).values(
        values.categoryIds.map((cid) => ({
          productId: id,
          categoryId: cid,
        })),
      );
    }

    // Colours: same delete-then-reinsert, but SCOPED to only the colour
    // attribute's values. Prevents wiping other attributes' rows when
    // more attributes become editable here.
    const validColourIds = await getColourValueIds(tx);
    const validColourIdArray = [...validColourIds];
    if (validColourIdArray.length > 0) {
      await tx.delete(productAttributeValue).where(
        and(
          eq(productAttributeValue.productId, id),
          inArray(productAttributeValue.attributeValueId, validColourIdArray),
        ),
      );
    }
    const bad = values.colourIds.filter((cid) => !validColourIds.has(cid));
    if (bad.length > 0) {
      throw new Error(`Ungültige Farb-IDs: ${bad.join(", ")}`);
    }
    if (values.colourIds.length > 0) {
      await tx.insert(productAttributeValue).values(
        values.colourIds.map((avId) => ({
          productId: id,
          attributeValueId: avId,
        })),
      );
    }

    // Variants: three-way diff (insert new, update existing, delete missing).
    // TODO(post-orders): before deleting, check for order_line rows
    // referencing this variant. Today no orders exist so a stray delete
    // would fail loudly on the FK. Once orders exist, refuse the delete
    // with a helpful message ("Variante hat Bestellungen; auf 'nicht
    // verfügbar' setzen statt löschen").
    const existing = await tx
      .select({ id: productVariant.id })
      .from(productVariant)
      .where(eq(productVariant.productId, id));
    const existingIds = new Set(existing.map((r) => r.id));
    const keptIds = new Set(
      variants.filter((v) => v.id !== null).map((v) => v.id as number),
    );
    const toDelete = [...existingIds].filter((eid) => !keptIds.has(eid));

    if (toDelete.length > 0) {
      await tx
        .delete(productVariant)
        .where(inArray(productVariant.id, toDelete));
    }

    for (const v of variants) {
      if (v.id === null) {
        await tx.insert(productVariant).values({
          productId: id,
          sizeLabelDe: v.sizeLabelDe,
          priceGross: v.priceGross,
          salePriceGross: v.salePriceGross,
          isAvailable: v.isAvailable,
          minQuantity: v.minQuantity,
          maxQuantity: v.maxQuantity,
          sortOrder: v.sortOrder,
        });
      } else {
        await tx
          .update(productVariant)
          .set({
            sizeLabelDe: v.sizeLabelDe,
            priceGross: v.priceGross,
            salePriceGross: v.salePriceGross,
            isAvailable: v.isAvailable,
            minQuantity: v.minQuantity,
            maxQuantity: v.maxQuantity,
            sortOrder: v.sortOrder,
          })
          .where(eq(productVariant.id, v.id));
      }
    }
  });

  revalidatePath("/admin/produkte");
  revalidatePath(`/admin/produkte/${id}`);
  redirect("/admin/produkte");
}
