"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";
import { requireAdmin } from "@/lib/admin/require-admin";

// Anonymise a customer by email from the Kunden split-pane view.
// Same DB effect as the Einstellungen-page action (same FADP erasure
// path) but redirects back to /admin/kunden with the selection kept,
// so Sandra sees the 'Gelöscht' message in context.
export async function anonymiseCustomerFromKundenAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const emailRaw = String(formData.get("email") ?? "").trim();
  const customerId = Number(formData.get("customerId") ?? "");
  const confirm = formData.get("confirm") === "yes";

  if (!emailRaw || !emailRaw.includes("@") || !confirm) {
    redirect("/admin/kunden?dsg=invalid");
  }

  const email = emailRaw.toLowerCase();

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
    redirect("/admin/kunden?dsg=notfound");
  }

  revalidatePath("/admin/kunden");
  redirect(
    Number.isFinite(customerId)
      ? `/admin/kunden?selected=${customerId}&dsg=ok`
      : "/admin/kunden?dsg=ok",
  );
}
