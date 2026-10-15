"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";
import { settings } from "@/db/schema/settings";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("Nicht angemeldet");
}

/**
 * Bulk-update every seeded settings row.
 *
 * Iterates all known keys, reads their new value from the form, and
 * UPDATEs the row if the value changed. Deliberately does NOT insert
 * missing keys - adding a new setting is a code + seed change so it
 * gets a migration path and a description_de, not a random row typed
 * into the admin.
 *
 * All updates run in one transaction so a mid-way error leaves the
 * settings table unchanged.
 */
export async function updateSettings(formData: FormData) {
  await requireAdmin();

  const currentRows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings);

  const changes: { key: string; value: string }[] = [];
  for (const row of currentRows) {
    const submittedRaw = formData.get(`setting.${row.key}`);
    if (submittedRaw === null) continue;
    const submitted = String(submittedRaw).trim();
    if (submitted !== row.value) {
      changes.push({ key: row.key, value: submitted });
    }
  }

  if (changes.length === 0) {
    redirect("/admin/einstellungen?ok=1");
  }

  await db.transaction(async (tx) => {
    for (const { key, value } of changes) {
      await tx
        .update(settings)
        .set({ value, updatedAt: new Date() })
        .where(eq(settings.key, key));
    }
  });

  revalidatePath("/admin/einstellungen");
  redirect("/admin/einstellungen?ok=1");
}

/**
 * revFADP erasure for a customer.
 *
 * Nulls the personal fields and stamps anonymised_at. Password hash
 * is replaced with a lockout string that can never match a real
 * bcrypt comparison, so the row can't be used to log in again even if
 * someone later clears anonymised_at by hand.
 *
 * Orders stay intact. Each order already carries buyer name / email /
 * phone as a snapshot (rule 1) - those are the retention-mandated
 * accounting fields. The anonymisation point is that no live record
 * can be used to re-identify the customer going forward; the historic
 * snapshots remain for the 10-year accounting window.
 */
export async function anonymiseCustomerAction(formData: FormData) {
  await requireAdmin();

  const emailRaw = String(formData.get("email") ?? "").trim();
  if (!emailRaw || !emailRaw.includes("@")) {
    redirect("/admin/einstellungen?dsg=invalid");
  }
  const email = emailRaw.toLowerCase();

  // Confirmation is a hidden "yes" field the UI only sends after the
  // user clicks through a native confirm(). Belt + braces so a stray
  // POST can't accidentally wipe a customer.
  if (formData.get("confirm") !== "yes") {
    redirect("/admin/einstellungen?dsg=unconfirmed");
  }

  const result = await db
    .update(customer)
    .set({
      email: sql`concat('anonymised-', ${customer.id}, '@local.invalid')`,
      firstName: null,
      lastName: null,
      phone: null,
      passwordHash: "ANONYMISED-NO-LOGIN",
      anonymisedAt: new Date(),
    })
    .where(sql`lower(${customer.email}) = ${email}`)
    .returning({ id: customer.id });

  if (result.length === 0) {
    redirect("/admin/einstellungen?dsg=notfound");
  }

  revalidatePath("/admin/einstellungen");
  redirect("/admin/einstellungen?dsg=ok");
}
