import type { Metadata } from "next";
import { LegalDraftBanner } from "@/components/storefront/legal-draft-banner";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description:
    "Welche Daten Magenta Blumen zur Bearbeitung von Bestellungen erhebt, wie wir sie schützen und welche Rechte Sie haben.",
  alternates: { canonical: "/datenschutz" },
};

/**
 * Swiss FADP-aware starter.
 *
 * Covers:
 *   - Who is the controller (Magenta Blumen) + contact
 *   - What data is collected (guest-order: name/email/phone/address +
 *     payment ID; no login by default)
 *   - Why (fulfilment + legal retention + customer communication)
 *   - Processors with jurisdiction + their roles (Hetzner CH, Stripe
 *     IE, Resend US, Cloudflare, Sentry DE)
 *   - Retention (10 years Swiss accounting law; anonymisation on
 *     request outside the retained accounting record)
 *   - User rights (access / correction / anonymisation)
 *   - Cookies (strictly necessary, no banner required)
 *   - Contact for data requests
 *
 * NOT a cookie banner — we only use strictly necessary cookies
 * (mb_cart, mb_checkout, auth session) and no tracking/analytics.
 * Under FADP + swiss case law a cookie banner is not required for
 * strictly-necessary cookies.
 */
export default function DatenschutzPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-10 lg:py-14 space-y-8">
      <LegalDraftBanner />

      <header className="space-y-2">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
          Rechtliches
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
          Datenschutzerklärung
        </h1>
      </header>

      <section className="space-y-6 text-[0.92rem] text-bark/80 leading-[1.75] font-light">
        <p>
          Diese Erklärung informiert Sie darüber, welche personenbezogenen
          Daten wir im Rahmen einer Bestellung bei Magenta Blumen
          erheben, zu welchem Zweck wir sie verarbeiten, mit welchen
          Dienstleistern wir dabei zusammenarbeiten und welche Rechte
          Sie als betroffene Person haben.
        </p>
        <p>
          Grundlage ist das revidierte Schweizer Bundesgesetz über den
          Datenschutz (DSG) in der ab 1. September 2023 geltenden
          Fassung.
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          1. Verantwortliche Stelle
        </h2>
        <p>
          Magenta Blumen
          <br />
          Zürcherstrasse 142, 5432 Neuenhof
          <br />
          <a
            href="mailto:info@magenta-blumen.ch"
            className="text-rose hover:underline"
          >
            info@magenta-blumen.ch
          </a>
          {" "}·{" "}
          <a href="tel:+41565565609" className="text-rose hover:underline">
            056 556 56 09
          </a>
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          2. Welche Daten wir erheben
        </h2>
        <p>Für die Abwicklung einer Bestellung erheben wir:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Besteller:</strong> Name, E-Mail-Adresse, Telefonnummer
          </li>
          <li>
            <strong>Lieferung:</strong> Name der empfangenden Person,
            Lieferadresse, optional eine Telefonnummer für Rückfragen
            bei der Zustellung
          </li>
          <li>
            <strong>Lieferkontext:</strong> Angaben wie Station und
            Zimmer bei Spitallieferungen oder die zur Zeremonie
            relevanten Angaben bei Trauerlieferungen
          </li>
          <li>
            <strong>Bestelldetails:</strong> gewählte Produkte, Preise,
            Lieferzeitpunkt, Kartentext und Hinweise
          </li>
          <li>
            <strong>Zahlung:</strong> die von Stripe (für Karte und
            TWINT) gelieferte Transaktions-Referenz. Kartendaten
            werden ausschliesslich bei Stripe gespeichert, nicht bei
            uns.
          </li>
        </ul>
        <p>
          Ein Konto ist nicht erforderlich. Jede Bestellung erfolgt als
          Gastbestellung; die Angaben werden pro Bestellung erfasst und
          sind nicht automatisch mit früheren Bestellungen verknüpft.
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          3. Zweck und Rechtsgrundlage
        </h2>
        <p>Wir verwenden die oben genannten Daten ausschliesslich für:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>die Abwicklung Ihrer Bestellung (Produktion, Lieferung, Zahlung)</li>
          <li>Rückfragen und Benachrichtigungen zur Bestellung</li>
          <li>die gesetzlich vorgeschriebene Aufbewahrung von Geschäftsunterlagen</li>
        </ul>
        <p>
          Rechtsgrundlage ist Art. 31 Abs. 2 lit. a DSG (Vertragserfüllung)
          sowie Art. 31 Abs. 2 lit. c DSG (gesetzliche Verpflichtungen).
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          4. Weitergabe an Dienstleister
        </h2>
        <p>
          Zur Erbringung unserer Leistungen arbeiten wir mit folgenden
          Auftragsbearbeitern zusammen:
        </p>
        <dl className="grid grid-cols-[160px_1fr] gap-y-3 gap-x-4 text-[0.88rem] border border-mist p-4">
          <dt className="text-sage">Hetzner Online GmbH</dt>
          <dd>
            Server-Hosting der Website und der Bestelldatenbank.
            Standort: Deutschland.
          </dd>

          <dt className="text-sage">Stripe Payments Europe Ltd.</dt>
          <dd>
            Verarbeitung von Karten- und TWINT-Zahlungen. Standort:
            Irland (EU) mit Datenverarbeitung in den USA.
            Datenschutzerklärung:{" "}
            <a
              href="https://stripe.com/en-ch/privacy"
              rel="noopener noreferrer"
              target="_blank"
              className="text-rose hover:underline"
            >
              stripe.com/en-ch/privacy
            </a>
          </dd>

          <dt className="text-sage">Resend, Inc.</dt>
          <dd>
            Versand von Bestellbestätigungen per E-Mail. Standort:
            USA.
            Datenschutzerklärung:{" "}
            <a
              href="https://resend.com/legal/privacy-policy"
              rel="noopener noreferrer"
              target="_blank"
              className="text-rose hover:underline"
            >
              resend.com/legal/privacy-policy
            </a>
          </dd>

          <dt className="text-sage">Cloudflare, Inc.</dt>
          <dd>
            Speicherung der Produktbilder (R2 Object Storage). Standort:
            EU-Region.
          </dd>

          <dt className="text-sage">Functional Software, Inc. (Sentry)</dt>
          <dd>
            Fehlerprotokollierung. Standort: Deutschland. Keine
            Übermittlung personenbezogener Bestelldaten; Sentry erhält
            technische Fehlerprotokolle ohne Bezug zu einzelnen Kunden.
          </dd>
        </dl>
        <p>
          Mit allen Dienstleistern bestehen Auftragsbearbeitungsverträge
          (AVV). Eine Weitergabe an weitere Dritte erfolgt nur, soweit
          dies zur Vertragserfüllung erforderlich ist oder eine
          gesetzliche Pflicht besteht.
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          5. Aufbewahrung
        </h2>
        <p>
          Bestelldaten mit Rechnungscharakter werden gemäss Art. 958f OR
          <strong> zehn Jahre</strong> aufbewahrt. Personenbezogene
          Felder (Empfängername, Kartentexte, Telefonnummern), die nicht
          Bestandteil der Rechnung sind, können auf Wunsch bereits
          früher anonymisiert werden; die Rechnung selbst bleibt
          erhalten.
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          6. Ihre Rechte
        </h2>
        <p>Sie haben jederzeit das Recht,</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Auskunft über die von uns gespeicherten Daten zu verlangen,</li>
          <li>unrichtige Daten berichtigen zu lassen,</li>
          <li>
            die Anonymisierung Ihrer personenbezogenen Felder zu verlangen
            (die rechnungsbezogenen Daten bleiben aus Aufbewahrungsgründen
            erhalten),
          </li>
          <li>
            Beschwerde beim Eidgenössischen Datenschutz- und
            Öffentlichkeitsbeauftragten (EDÖB) einzureichen.
          </li>
        </ul>
        <p>
          Anfragen richten Sie bitte per E-Mail an{" "}
          <a
            href="mailto:info@magenta-blumen.ch"
            className="text-rose hover:underline"
          >
            info@magenta-blumen.ch
          </a>
          . Wir antworten in der Regel innert 30 Tagen.
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          7. Cookies
        </h2>
        <p>
          Wir verwenden ausschliesslich technisch notwendige Cookies.
          Diese sind für den Betrieb der Website erforderlich und
          bedürfen nach schweizerischem Recht keiner Einwilligung:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>mb_cart</strong> – speichert die Produkte in Ihrem
            Warenkorb (keine Preise, keine persönlichen Daten).
          </li>
          <li>
            <strong>mb_checkout</strong> – speichert Ihren Fortschritt
            während des Bestellvorgangs (Lieferadresse, Zeitfenster,
            Angaben zur empfangenden Person). Wird nach erfolgreicher
            Bestellung gelöscht; läuft ansonsten nach 6 Stunden ab.
          </li>
          <li>
            <strong>Auth.js Session-Cookie</strong> – nur im
            Admin-Bereich für die Mitarbeiterinnen.
          </li>
        </ul>
        <p>
          Wir setzen <strong>keine</strong> Analyse- oder
          Marketing-Cookies, kein Google Analytics und keine Social-Media-
          Tracker.
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          8. Sicherheit
        </h2>
        <p>
          Die Website ist durchgängig per TLS verschlüsselt (HTTPS).
          Zahlungsvorgänge finden direkt zwischen Ihrem Gerät und
          Stripe statt; Kartendaten passieren unsere Server nicht.
          Admin-Zugänge sind durch Passwort geschützt und auf das
          minimal notwendige Personal beschränkt.
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          9. Änderungen dieser Erklärung
        </h2>
        <p>
          Wir können diese Datenschutzerklärung bei Änderungen der
          Rechtslage oder unserer Dienste anpassen. Die jeweils aktuelle
          Version ist auf dieser Seite abrufbar.
        </p>
      </section>

      <footer className="pt-6 border-t border-mist text-[0.72rem] text-sage">
        Stand: Oktober 2026
      </footer>
    </div>
  );
}
