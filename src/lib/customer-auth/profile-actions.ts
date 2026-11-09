"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";
import {
  isCustomerAuthRateLimited,
  recordCustomerAuthFailure,
} from "./rate-limit";

/**
 * Customer profile + password actions. Each re-checks auth itself — server
 * actions are public URL endpoints (red zone #2 in CLAUDE.md).
 *
 * All redirects use ?p=… query params (short so URLs stay clean) that the
 * /konto page reads to render success / error banners.
 */

const PHONE_RE = /^[+0-9 ()./-]{6,30}$/;

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

/**
 * Update the low-risk profile fields (name, phone). No password confirmation
 * needed — these aren't security-sensitive.
 */
export async function updateProfileAction(formData: FormData): Promise<void> {
  const customerId = await requireCustomerId();

  const firstName = String(formData.get("firstName") ?? "").trim().slice(0, 80);
  const lastName = String(formData.get("lastName") ?? "").trim().slice(0, 80);
  const phone = String(formData.get("phone") ?? "").trim();

  if (!firstName || !lastName) {
    revalidatePath("/konto");
    return;
  }
  if (!PHONE_RE.test(phone)) {
    revalidatePath("/konto");
    return;
  }

  await db
    .update(customer)
    .set({ firstName, lastName, phone })
    .where(eq(customer.id, customerId));

  revalidatePath("/konto");
}

/**
 * Change password. Requires the CURRENT password (session alone isn't enough —
 * someone who walks up to a logged-in laptop should not be able to lock out
 * the owner). New password rules match signup: 8+ chars.
 *
 * Rate-limited: a wrong current-password attempt burns a customer-auth
 * failure slot same as signin.
 */
export async function changePasswordAction(formData: FormData): Promise<{
  ok: boolean;
  reason?: "rate_limited" | "wrong_current" | "weak_new" | "mismatch";
}> {
  const customerId = await requireCustomerId();

  if (await isCustomerAuthRateLimited()) {
    return { ok: false, reason: "rate_limited" };
  }

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");

  if (next !== confirm) {
    return { ok: false, reason: "mismatch" };
  }
  if (next.length < 8 || next.length > 200) {
    return { ok: false, reason: "weak_new" };
  }

  const [row] = await db
    .select({ passwordHash: customer.passwordHash })
    .from(customer)
    .where(eq(customer.id, customerId))
    .limit(1);

  if (!row) throw new Error("Kunde nicht gefunden");

  const ok = await bcrypt.compare(current, row.passwordHash);
  if (!ok) {
    await recordCustomerAuthFailure();
    return { ok: false, reason: "wrong_current" };
  }

  const newHash = await bcrypt.hash(next, 10);
  await db
    .update(customer)
    .set({ passwordHash: newHash })
    .where(eq(customer.id, customerId));

  revalidatePath("/konto");
  return { ok: true };
}
