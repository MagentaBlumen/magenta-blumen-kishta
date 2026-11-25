"use server";

import { redirect } from "next/navigation";
import {
  isCustomerAuthRateLimited,
  recordCustomerAuthFailure,
} from "@/lib/customer-auth/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email/send";

/**
 * Request a password-reset email. Always redirects to ?sent=1 unless
 * the IP is rate-limited — we never tell the browser whether the
 * email matched a real customer row (standard anti-enumeration).
 *
 * The send function itself returns "skipped" for unknown emails and
 * anonymised customers; "sent" for a real hit. We throw away the
 * distinction here on purpose.
 */
export async function requestPasswordResetAction(
  formData: FormData,
): Promise<void> {
  if (await isCustomerAuthRateLimited()) {
    redirect("/konto/passwort-vergessen?error=rate-limited");
  }

  const emailRaw = String(formData.get("email") ?? "");
  if (!emailRaw.includes("@")) {
    // Still answer "sent" so a malformed input doesn't reveal that we
    // check shape before looking up the row. Also record a failure so
    // a script hammering the endpoint eventually rate-limits itself.
    await recordCustomerAuthFailure();
    redirect("/konto/passwort-vergessen?sent=1");
  }

  // Fire-and-forget. A Resend outage does not change the user flow —
  // they'd retype the email in 10 seconds anyway if nothing arrives.
  // The send itself is idempotent-ish: multiple clicks produce
  // multiple working tokens, all invalidated on the first successful
  // reset (the password hash fingerprint changes).
  await sendPasswordResetEmail(emailRaw);

  redirect("/konto/passwort-vergessen?sent=1");
}
