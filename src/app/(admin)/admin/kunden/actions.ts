"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";
import { requireAdmin } from "@/lib/admin/require-admin";
import { anonymiseCustomer } from "@/lib/customer-auth/anonymise";
import { sendAnonymisationEmail } from "@/lib/email/send";

// revFADP erasure entry-point from the Kunden split-pane view. Same
// DB effect as `anonymiseCustomerAction` on the Einstellungen page —
// both delegate to the shared `anonymiseCustomer` helper — but
// redirects back to /admin/kunden with the selection kept so Sandra
// sees the 'Gelöscht' message in context.
export async function anonymiseCustomerFromKundenAction(
  formData: FormData,
): Promise<void> {
  await requireAdmin();

  const emailRaw = String(formData.get("email") ?? "").trim();
  const customerIdRaw = Number(formData.get("customerId") ?? "");
  const confirm = formData.get("confirm") === "yes";

  if (!emailRaw || !emailRaw.includes("@") || !confirm) {
    redirect("/admin/kunden?dsg=invalid");
  }

  const email = emailRaw.toLowerCase();

  const [found] = await db
    .select({ id: customer.id })
    .from(customer)
    .where(sql`lower(${customer.email}) = ${email}`)
    .limit(1);

  if (!found) {
    redirect("/admin/kunden?dsg=notfound");
  }

  const result = await anonymiseCustomer(found.id);
  if (!result.found) {
    redirect("/admin/kunden?dsg=notfound");
  }

  if (result.snapshot) {
    await sendAnonymisationEmail(result.snapshot).catch((err) => {
      console.error(
        `[anonymise] farewell email dispatch failed for customer ${found.id}:`,
        err,
      );
    });
  }

  revalidatePath("/admin/kunden");
  redirect(
    Number.isFinite(customerIdRaw)
      ? `/admin/kunden?selected=${customerIdRaw}&dsg=ok`
      : "/admin/kunden?dsg=ok",
  );
}
