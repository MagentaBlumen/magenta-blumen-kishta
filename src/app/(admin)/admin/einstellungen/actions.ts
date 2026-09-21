"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db/client";
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
