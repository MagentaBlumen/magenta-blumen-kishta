"use server";

import { redirect } from "next/navigation";
import { sendContactFormMessage } from "@/lib/email/send";
import {
  isContactFormRateLimited,
  recordContactFormSubmission,
} from "@/lib/contact/rate-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function s(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

export async function submitContactFormAction(
  formData: FormData,
): Promise<void> {
  if (await isContactFormRateLimited()) {
    redirect("/kontakt?error=rate-limited");
  }

  const name = s(formData.get("name")).trim();
  const email = s(formData.get("email")).trim().toLowerCase();
  const phoneRaw = s(formData.get("phone")).trim();
  const phone = phoneRaw ? phoneRaw.slice(0, 40) : null;
  const message = s(formData.get("message")).trim();

  if (
    !name ||
    name.length > 120 ||
    !email ||
    !EMAIL_RE.test(email) ||
    email.length > 254 ||
    !message ||
    message.length < 5 ||
    message.length > 2000
  ) {
    redirect("/kontakt?error=invalid");
  }

  // Count the attempt BEFORE sending so a flood that overloads Resend
  // is already debounced by the rate limit on the next hit.
  await recordContactFormSubmission();

  const { shop, ack } = await sendContactFormMessage({
    name,
    email,
    phone,
    message,
  });

  // The shop email is the load-bearing one. If it failed, the message
  // didn't reach Sandra, so we don't claim success. The ack back to
  // the customer is best-effort: a quiet skip is fine.
  if (shop === "failed") {
    redirect("/kontakt?error=send-failed");
  }

  // "skipped" happens in environments without Resend wired up (CI,
  // local dev). Prod should always send. Treat skipped as success so
  // the form stays usable during local dev.
  void ack;
  redirect("/kontakt?ok=1");
}
