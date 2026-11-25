import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  verifyOrderDeepLinkToken,
  writeOrderViewToken,
} from "@/lib/order-lookup/token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bestellung öffnen",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

/**
 * Click target for the "Status abrufbar unter …" link in every
 * outbound order e-mail. Verifies the signed deep-link token, mints a
 * fresh 24 h view-cookie, and redirects to the actual status page.
 *
 * On a bad / expired token: renders a friendly dead-end with a nudge
 * to call the shop. We never leak WHY the token is invalid — expired
 * vs. tampered are both the same UX.
 */
export default async function BestellungZugangPage({ params }: PageProps) {
  const { token } = await params;
  const verified = verifyOrderDeepLinkToken(token);

  if (!verified.ok) {
    return (
      <div className="max-w-md mx-auto px-4 lg:px-6 py-16 lg:py-24 space-y-6 text-center">
        <h1 className="font-display font-light text-bark text-[1.8rem] leading-[1.1]">
          Link ungültig.
        </h1>
        <p className="text-[14px] text-bark/75 leading-[1.6]">
          Der Link in Ihrer Bestätigungsmail ist nicht mehr gültig.
          Möchten Sie den Stand einer Bestellung prüfen, rufen Sie uns
          bitte an unter{" "}
          <a
            href="tel:+41565565609"
            className="text-rose font-medium hover:underline"
          >
            056 556 56 09
          </a>{" "}
          — wir schauen gern nach.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-12 px-6 bg-bark text-ivory text-[14px] font-semibold hover:bg-rose transition-colors"
        >
          Zur Startseite
        </Link>
      </div>
    );
  }

  // Mint a fresh 24 h view-cookie bound to this order number, then
  // forward to the status page. `redirect()` throws NEXT_REDIRECT; the
  // Next runtime handles it. Must happen after the cookie write so the
  // destination page sees it on the same request.
  await writeOrderViewToken(verified.orderNumber);
  redirect(
    `/bestellung-finden/${encodeURIComponent(verified.orderNumber)}`,
  );
}
