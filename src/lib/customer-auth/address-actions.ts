"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { customerAddress } from "@/db/schema/customer";

/**
 * Address-book CRUD for the logged-in customer.
 *
 * Addresses are COPIED onto orders at checkout (schema rule in
 * src/db/schema/order.ts). Nothing references customer_address from
 * order, so a delete here is a plain DELETE — past orders keep their
 * snapshot untouched.
 *
 * Ownership check on every write: the id must belong to the current
 * customer. Otherwise a malicious client could delete / rewrite any
 * address row by guessing an id.
 */

async function requireCustomerId(): Promise<number> {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "customer" ||
    !session.user.customerId
  ) {
    throw new Error("Nicht angemeldet");
  }
  return session.user.customerId;
}

const PHONE_RE = /^[+0-9 ()./-]{6,30}$/;
const PLZ_RE = /^\d{4}$/;

type AddressInput = {
  labelDe: string | null;
  recipientName: string;
  street: string;
  plz: string;
  city: string;
  phone: string | null;
  notes: string | null;
};

function parseAddressForm(formData: FormData): AddressInput | null {
  const labelDe = String(formData.get("labelDe") ?? "").trim().slice(0, 80) || null;
  const recipientName = String(formData.get("recipientName") ?? "")
    .trim()
    .slice(0, 120);
  const street = String(formData.get("street") ?? "").trim().slice(0, 200);
  const plz = String(formData.get("plz") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim().slice(0, 100);
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;

  if (!recipientName || !street || !city) return null;
  if (!PLZ_RE.test(plz)) return null;
  const phone = phoneRaw ? (PHONE_RE.test(phoneRaw) ? phoneRaw : null) : null;

  return { labelDe, recipientName, street, plz, city, phone, notes };
}

export async function addCustomerAddressAction(
  formData: FormData,
): Promise<void> {
  const customerId = await requireCustomerId();
  const input = parseAddressForm(formData);
  if (!input) {
    revalidatePath("/konto");
    return;
  }

  await db.insert(customerAddress).values({
    customerId,
    ...input,
  });

  revalidatePath("/konto");
}

export async function updateCustomerAddressAction(
  idRaw: number,
  formData: FormData,
): Promise<void> {
  const customerId = await requireCustomerId();
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) return;

  const input = parseAddressForm(formData);
  if (!input) {
    revalidatePath("/konto");
    return;
  }

  // AND on customer_id = ownership gate. Even if a hostile client posts
  // another customer's id, the WHERE filters it out.
  await db
    .update(customerAddress)
    .set(input)
    .where(
      and(
        eq(customerAddress.id, id),
        eq(customerAddress.customerId, customerId),
      ),
    );

  revalidatePath("/konto");
}

export async function deleteCustomerAddressAction(idRaw: number): Promise<void> {
  const customerId = await requireCustomerId();
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id <= 0) return;

  await db
    .delete(customerAddress)
    .where(
      and(
        eq(customerAddress.id, id),
        eq(customerAddress.customerId, customerId),
      ),
    );

  revalidatePath("/konto");
}
