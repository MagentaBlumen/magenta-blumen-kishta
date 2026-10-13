"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { createCustomer } from "@/lib/customer-auth/signup";
import {
  isCustomerAuthRateLimited,
  recordCustomerAuthFailure,
} from "@/lib/customer-auth/rate-limit";

/**
 * Signup server action. Called from /konto/registrieren form.
 *
 * On success we immediately signIn the new customer so they land on
 * /konto without a second password prompt. On duplicate email we
 * redirect back with ?error=email_exists so the user can switch to
 * the signin page without typing their email again.
 */

export async function signupAction(formData: FormData): Promise<void> {
  if (await isCustomerAuthRateLimited()) {
    redirect("/konto/registrieren?error=RateLimited");
  }

  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("firstName") ?? "");
  const lastName = String(formData.get("lastName") ?? "");
  const phone = String(formData.get("phone") ?? "");

  const result = await createCustomer({
    email,
    password,
    firstName,
    lastName,
    phone,
  });

  if (!result.ok) {
    // Only count genuine signup failures (duplicate email, weak
    // password) against the budget - shape errors are typos.
    if (result.reason === "email_exists") {
      await recordCustomerAuthFailure();
    }
    redirect(`/konto/registrieren?error=${result.reason}`);
  }

  // Immediate sign-in. Next-auth's signIn redirects on success.
  await signIn("customer", {
    email,
    password,
    redirectTo: "/konto",
  });
}
