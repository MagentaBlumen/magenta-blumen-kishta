"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";
import { settings } from "@/db/schema/settings";
import { requireAdmin } from "@/lib/admin/require-admin";
import { anonymiseCustomer } from "@/lib/customer-auth/anonymise";
import { sendAnonymisationEmail } from "@/lib/email/send";

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
 * revFADP erasure entry-point from Einstellungen. Looks the customer
 * up by email, delegates the whole erasure to the shared
 * `anonymiseCustomer` helper in one transaction, then redirects back
 * to the settings page with a status flag.
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

  const [found] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(sql`lower(${customer.email}) = ${email}`)
    .limit(1);

  if (!found) {
    redirect("/admin/einstellungen?dsg=notfound");
  }

  const result = await anonymiseCustomer(found.id);
  if (!result.found) {
    redirect("/admin/einstellungen?dsg=notfound");
  }

  // Farewell mail is best-effort. A Resend outage must not undo the
  // erasure that just committed; fire-and-forget. `snapshot` is null
  // when the customer was already anonymised — skip the mail there.
  if (result.snapshot) {
    await sendAnonymisationEmail(result.snapshot).catch((err) => {
      console.error(
        `[anonymise] farewell email dispatch failed for customer ${found.id}:`,
        err,
      );
    });
  }

  revalidatePath("/admin/einstellungen");
  redirect("/admin/einstellungen?dsg=ok");
}
