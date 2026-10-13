import type { Metadata } from "next";
import { lookupOrderAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bestellung finden",
  description:
    "Status Ihrer Bestellung bei Magenta Blumen - mit Bestellnummer und E-Mail.",
  alternates: { canonical: "/bestellung-finden" },
  robots: { index: false, follow: false },
};

/**
 * Guest "where is my order" form. Standalone from checkout - buyers
 * who lost their confirmation email can still get here, type their
 * order number + email, and see the status.
 *
 * No login, no account. The confirmation email contains the number,
 * and knowledge of (number + email) is treated as proof of ownership.
 */

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function BestellungFindenPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <div className="max-w-xl mx-auto px-4 lg:px-6 py-14 lg:py-20 space-y-8">
      <header className="space-y-2">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
          Status abfragen
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
          Bestellung finden
        </h1>
        <p className="text-[0.9rem] text-bark/75 leading-[1.7] font-light">
          Geben Sie Ihre Bestellnummer und die bei der Bestellung angegebene
          E-Mail-Adresse ein, um den aktuellen Status zu sehen.
        </p>
      </header>

      <form action={lookupOrderAction} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="orderNumber"
            className="block text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium"
          >
            Bestellnummer
          </label>
          <input
            id="orderNumber"
            name="orderNumber"
            type="text"
            autoComplete="off"
            inputMode="text"
            placeholder="MB-20261013-A1B2C3D4"
            required
            className="w-full border border-mist bg-ivory px-3 py-2.5 text-[0.95rem] text-bark font-mono tabular-nums focus:border-rose focus:outline-none"
          />
          <p className="text-[0.72rem] text-sage">
            Format: MB-TTTTMMJJ-XXXXXXXX. Die Nummer steht in Ihrer
            Bestellbestätigung.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium"
          >
            E-Mail-Adresse
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full border border-mist bg-ivory px-3 py-2.5 text-[0.95rem] text-bark focus:border-rose focus:outline-none"
          />
          <p className="text-[0.72rem] text-sage">
            Dieselbe Adresse, die Sie beim Bestellen angegeben haben.
          </p>
        </div>

        {error === "NotFound" && (
          <p className="text-[0.85rem] text-rose">
            Keine Bestellung zu dieser Kombination gefunden. Prüfen Sie bitte
            Bestellnummer und E-Mail und versuchen Sie es erneut.
          </p>
        )}
        {error === "RateLimited" && (
          <p className="text-[0.85rem] text-rose">
            Zu viele Versuche. Bitte warten Sie ca. 15 Minuten und versuchen Sie
            es erneut, oder rufen Sie uns an.
          </p>
        )}

        <button
          type="submit"
          className="w-full bg-bark text-ivory px-6 py-3 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose transition-colors"
        >
          Status anzeigen
        </button>
      </form>

      <div className="pt-6 border-t border-mist text-[0.82rem] text-bark/70 leading-[1.65] space-y-2">
        <p>
          Sie finden Ihre Bestellnummer in der Bestätigungs-E-Mail nach dem Kauf
          - das Feld heisst «Ihre Bestellnummer».
        </p>
        <p>
          Keine Bestätigung erhalten oder beide Daten verloren? Rufen Sie uns an
          unter{" "}
          <a href="tel:+41565565609" className="text-rose hover:underline">
            056 556 56 09
          </a>
          .
        </p>
      </div>
    </div>
  );
}
