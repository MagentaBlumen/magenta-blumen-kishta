import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bestellung erhalten",
  robots: { index: false, follow: false },
};

/**
 * Success page after a successful reserve. Deliberately non-DB: we
 * take the order number from the query string, since reading the DB
 * would tempt someone to authenticate/authorise this page - and this
 * URL should be a safe bookmark that stays valid even when the cart
 * cookie is long gone.
 *
 * The actual receipt (line items, prices, address) lands with the
 * "customer account" work in a later session. For now this page's
 * job is to reassure the customer the order was received.
 */
export default async function KasseErfolgPage({
  searchParams,
}: {
  searchParams: Promise<{ bestellnummer?: string }>;
}) {
  const { bestellnummer } = await searchParams;
  const orderNumber = sanitiseOrderNumber(bestellnummer);

  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 py-16 lg:py-24 text-center space-y-6">
      <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
        Bestellung erhalten
      </p>
      <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
        Vielen Dank.
      </h1>
      <p className="text-[0.9rem] text-bark/75 leading-[1.7] font-light">
        Wir haben Ihre Bestellung erhalten und den Liefertermin für Sie
        reserviert. Sie bekommen in Kürze eine Bestätigung per E-Mail.
      </p>

      {orderNumber && (
        <div className="mt-4 inline-block border border-mist px-6 py-4 text-left">
          <div className="text-[0.68rem] tracking-[0.16em] uppercase text-sage font-medium">
            Ihre Bestellnummer
          </div>
          <div className="font-display text-[1.4rem] text-bark tabular-nums mt-1">
            {orderNumber}
          </div>
          <p className="text-[0.72rem] text-sage mt-2 leading-[1.55]">
            Bei Rückfragen erwähnen Sie bitte diese Nummer.
          </p>
        </div>
      )}

      <div className="mt-8 space-y-2 text-[0.85rem] text-bark/75 leading-[1.7]">
        <p>
          <strong className="text-bark font-medium">Barzahlung:</strong> Sie
          bezahlen bei Abholung oder an der Haustür an unsere Fahrerin.
        </p>
        <p>
          <strong className="text-bark font-medium">Rechnung:</strong> Wir
          schicken Ihnen die Rechnung per E-Mail. Zahlungsziel 30 Tage.
        </p>
      </div>

      <div className="pt-6 flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="inline-block bg-bark text-ivory px-9 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose transition-colors"
        >
          Zurück zur Startseite
        </Link>
        <a
          href="tel:+41565565609"
          className="inline-block border border-bark text-bark px-9 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-bark hover:text-ivory transition-colors"
        >
          Anrufen: 056 556 56 09
        </a>
      </div>
    </div>
  );
}

/**
 * Only accept our own order-number format. Prevents someone from
 * pasting a URL with a mocked value and having it echo back through
 * the page as though it were real.
 */
function sanitiseOrderNumber(raw: string | undefined): string | null {
  if (!raw) return null;
  return /^MB-\d{8}-[0-9A-F]{8}$/.test(raw) ? raw : null;
}
