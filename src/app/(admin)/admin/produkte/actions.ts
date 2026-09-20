"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { product, productCategory } from "@/db/schema/catalogue";
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
  };
}

function numFromForm(fd: FormData, name: string, fallback: number): number {
  const raw = String(fd.get(name) ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`Ungültige Zahl für ${name}`);
  return n;
}

// -------- create --------

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const values = parseProductForm(formData);

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

    return row;
  });

  revalidatePath("/admin/produkte");
  redirect(`/admin/produkte/${inserted.id}`);
}

// -------- update --------

export async function updateProduct(id: number, formData: FormData) {
  await requireAdmin();
  const values = parseProductForm(formData);

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

    // Diff categories: simplest correct approach is delete + reinsert.
    // Product has few categories (~5 max in practice), so the delete +
    // insert cost is trivial and the code stays obvious. If this ever
    // becomes hot, switch to compute-diff.
    await tx.delete(productCategory).where(eq(productCategory.productId, id));
    if (values.categoryIds.length > 0) {
      await tx.insert(productCategory).values(
        values.categoryIds.map((cid) => ({
          productId: id,
          categoryId: cid,
        })),
      );
    }
  });

  revalidatePath("/admin/produkte");
  revalidatePath(`/admin/produkte/${id}`);
  redirect("/admin/produkte");
}
