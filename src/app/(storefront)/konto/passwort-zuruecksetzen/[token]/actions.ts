"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";
import { verifyPasswordResetToken } from "@/lib/customer-auth/account-tokens";
import { sendPasswordChangedEmail } from "@/lib/email/send";

/**
 * Commits a new password after the user submits the reset form. The
 * signed token proves the customer owned the recovery email at
 * issue-time AND that no reset has succeeded since; both are
 * invariants we re-check here, not just at page render.
 *
 * The password hash itself is part of the token's HMAC input (first
 * 16 chars), so this update automatically invalidates every other
 * outstanding reset link for the same customer.
 */
export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token || token.split(".").length !== 4) {
    redirect("/konto/passwort-vergessen?error=rate-limited");
  }

  if (newPassword !== confirmPassword) {
    redirect(
      `/konto/passwort-zuruecksetzen/${encodeURIComponent(token)}?error=mismatch`,
    );
  }
  if (newPassword.length < 8 || newPassword.length > 200) {
    redirect(
      `/konto/passwort-zuruecksetzen/${encodeURIComponent(token)}?error=weak`,
    );
  }

  const idFromToken = Number(token.split(".")[0]);
  if (!Number.isFinite(idFromToken) || idFromToken <= 0) {
    redirect(
      `/konto/passwort-zuruecksetzen/${encodeURIComponent(token)}?error=stale`,
    );
  }

  const [row] = await db
    .select({
      id: customer.id,
      passwordHash: customer.passwordHash,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customer)
    .where(eq(customer.id, idFromToken))
    .limit(1);

  if (!row || row.anonymisedAt) {
    redirect(
      `/konto/passwort-zuruecksetzen/${encodeURIComponent(token)}?error=stale`,
    );
  }

  const verified = verifyPasswordResetToken(token, row.passwordHash);
  if (!verified.ok) {
    redirect(
      `/konto/passwort-zuruecksetzen/${encodeURIComponent(token)}?error=stale`,
    );
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(customer)
    .set({ passwordHash: newHash })
    .where(eq(customer.id, row.id));

  // Fire-and-forget confirmation. "If this wasn't you, call us"
  // belongs in the mail, not on the login page the attacker is about
  // to see. Never throws.
  await sendPasswordChangedEmail(row.id).catch((err) => {
    console.error(
      `[password-reset] confirmation email dispatch failed for customer ${row.id}:`,
      err,
    );
  });

  // Finished — send them to the signin page with a one-shot success
  // hint. Not auto-signing-in on purpose: knowing the new password
  // and getting to log in with it is a useful reassurance step.
  redirect("/konto/anmelden?reset=ok");
}
