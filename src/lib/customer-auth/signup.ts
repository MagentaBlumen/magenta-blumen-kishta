import "server-only";
import bcrypt from "bcryptjs";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";

/**
 * Create a customer row. Returns { ok: true, id } on success,
 * { ok: false, reason } on validation / duplicate-email failure.
 *
 * We rely on the uniqueIndex `customer_email_lower_unique` for the
 * race-free duplicate check: insert, catch the UNIQUE violation, map
 * to a user-friendly reason. A pre-check SELECT would be a TOCTOU
 * race.
 *
 * No email verification sent here - CLAUDE.md says the account works
 * immediately. Verification is a separate Phase 2 ask.
 */

export type SignupInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type SignupResult =
  | { ok: true; id: number }
  | { ok: false; reason: "invalid" | "weak_password" | "email_exists" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+0-9 ()./-]{6,30}$/;

export async function createCustomer(input: SignupInput): Promise<SignupResult> {
  const email = input.email.trim().toLowerCase();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const phone = input.phone.trim();

  if (!EMAIL_RE.test(email)) return { ok: false, reason: "invalid" };
  if (!firstName || firstName.length > 80) return { ok: false, reason: "invalid" };
  if (!lastName || lastName.length > 80) return { ok: false, reason: "invalid" };
  if (!PHONE_RE.test(phone)) return { ok: false, reason: "invalid" };

  // 8 chars min matches the shop's single-admin password policy. We
  // don't require numbers/symbols - a long passphrase is better than
  // a short one with mixed classes, and user-friction loses signups.
  if (input.password.length < 8 || input.password.length > 200) {
    return { ok: false, reason: "weak_password" };
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    const [row] = await db
      .insert(customer)
      .values({
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
      })
      .returning({ id: customer.id });

    return { ok: true, id: row.id };
  } catch (err) {
    if (isUniqueViolation(err)) {
      return { ok: false, reason: "email_exists" };
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  // Drizzle wraps the pg error; the pg driver's code 23505 lives
  // either on err.code or on err.cause.code depending on which layer
  // threw. Check both.
  const code = (err as { code?: string }).code;
  if (code === "23505") return true;
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === "object") {
    return (cause as { code?: string }).code === "23505";
  }
  return false;
}

