import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";
import { verifyEmailVerificationToken } from "@/lib/customer-auth/account-tokens";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "E-Mail bestätigen",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

/**
 * Click target for the welcome email's "E-Mail bestätigen" link.
 *
 * Verifying the signed token stamps `customer.email_verified_at`.
 * Nothing is gated on this click — per CLAUDE.md verification is
 * voluntary — but the stamped timestamp is required for password
 * reset to work (unverified email + reset request = we tell the
 * customer to call the shop).
 *
 * Idempotent: a second click on the same link is a no-op if the
 * timestamp is already set.
 */
export default async function EmailBestaetigenPage({ params }: PageProps) {
  const { token } = await params;
  const verified = verifyEmailVerificationToken(token);

  if (!verified.ok) return <InvalidView reason={verified.reason} />;

  const [row] = await db
    .select({
      id: customer.id,
      emailVerifiedAt: customer.emailVerifiedAt,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customer)
    .where(eq(customer.id, verified.customerId))
    .limit(1);

  if (!row || row.anonymisedAt) return <InvalidView reason="signature" />;

  if (!row.emailVerifiedAt) {
    await db
      .update(customer)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(customer.id, row.id));
  }

  return (
    <div className="max-w-md mx-auto px-4 lg:px-6 py-12 lg:py-20 space-y-6 text-center">
      <h1 className="font-display font-light text-bark text-[2rem] leading-[1.1]">
        E-Mail bestätigt.
      </h1>
      <p className="text-[14px] text-bark/75 leading-[1.6]">
        Danke — Ihre E-Mail-Adresse ist jetzt verifiziert. Sie können
        das Fenster schliessen oder zu Ihrem Konto wechseln.
      </p>
      <Link
        href="/konto"
        className="inline-flex items-center gap-2 h-12 px-6 bg-rose text-ivory text-[14px] font-semibold hover:brightness-110 transition-[filter]"
      >
        Zu meinem Konto
      </Link>
    </div>
  );
}

function InvalidView({ reason }: { reason?: string }) {
  const msg =
    reason === "expired"
      ? "Der Bestätigungslink ist abgelaufen."
      : "Der Bestätigungslink ist ungültig.";
  return (
    <div className="max-w-md mx-auto px-4 lg:px-6 py-12 lg:py-20 space-y-6 text-center">
      <h1 className="font-display font-light text-bark text-[1.8rem] leading-[1.1]">
        Link ungültig.
      </h1>
      <p className="text-[14px] text-bark/75 leading-[1.6]">
        {msg} Sie können den Link in Ihrer Begrüssungsmail erneut
        öffnen oder sich einfach normal einloggen — Verifikation ist
        freiwillig und wird nur für Passwort-Rücksetzung gebraucht.
      </p>
      <Link
        href="/konto/anmelden"
        className="inline-flex items-center gap-2 h-12 px-6 bg-bark text-ivory text-[14px] font-semibold hover:bg-rose transition-colors"
      >
        Zum Login
      </Link>
    </div>
  );
}
