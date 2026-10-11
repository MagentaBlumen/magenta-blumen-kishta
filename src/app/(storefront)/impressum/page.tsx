import type { Metadata } from "next";
import { LegalDraftBanner } from "@/components/storefront/legal-draft-banner";

export const metadata: Metadata = {
  title: "Impressum",
  description:
    "Rechtliche Angaben zu Magenta Blumen, Zürcherstrasse 142, 5432 Neuenhof.",
  alternates: { canonical: "/impressum" },
};

/**
 * Legally required under Swiss commerce law (OR 322a / UWG 3 lit. s).
 * Must identify who is behind the website. Mobile phone, email,
 * MWST number, and physical address covered. Rechtsform + UID (if
 * distinct from MWST) still placeholders - the owner confirms.
 */
export default function ImpressumPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-10 lg:py-14 space-y-8">
      <LegalDraftBanner />

      <header className="space-y-2">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
          Rechtliches
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
          Impressum
        </h1>
      </header>

      <section className="space-y-5 text-[0.95rem] text-bark/80 leading-[1.75] font-light">
        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          Anbieter
        </h2>
        <dl className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-[0.9rem]">
          <dt className="text-sage">Firma</dt>
          <dd>Magenta Blumen</dd>

          <dt className="text-sage">Rechtsform</dt>
          <dd>
            Einzelfirma
            <span className="block text-[0.75rem] text-sage mt-0.5">
              Bitte durch die Inhaberin bestätigen (Einzelfirma / GmbH /
              AG).
            </span>
          </dd>

          <dt className="text-sage">Adresse</dt>
          <dd>
            Zürcherstrasse 142
            <br />
            5432 Neuenhof AG
            <br />
            Schweiz
          </dd>

          <dt className="text-sage">Telefon</dt>
          <dd>
            <a href="tel:+41565565609" className="hover:text-bark">
              056 556 56 09
            </a>
            <br />
            <a href="tel:+41763410232" className="hover:text-bark">
              076 341 02 32
            </a>
          </dd>

          <dt className="text-sage">E-Mail</dt>
          <dd>
            <a
              href="mailto:info@magenta-blumen.ch"
              className="hover:text-bark"
            >
              info@magenta-blumen.ch
            </a>
          </dd>

          <dt className="text-sage">MWST-Nummer</dt>
          <dd className="tabular-nums">CHE-363.951.581 MWST</dd>

          <dt className="text-sage">UID</dt>
          <dd className="tabular-nums">
            CHE-363.951.581
            <span className="block text-[0.75rem] text-sage mt-0.5">
              UID und MWST-Nummer sind in der Regel identisch; bitte
              durch die Inhaberin bestätigen.
            </span>
          </dd>
        </dl>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          Haftungsausschluss
        </h2>
        <p>
          Trotz sorgfältiger inhaltlicher Prüfung übernehmen wir keine
          Haftung für die Richtigkeit, Vollständigkeit und Aktualität
          der Inhalte dieser Website. Für den Inhalt verlinkter externer
          Seiten sind ausschliesslich deren Betreiber verantwortlich.
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          Urheberrecht
        </h2>
        <p>
          Die Inhalte und Werke auf dieser Website sind urheberrechtlich
          geschützt. Jede Verwendung ausserhalb der engen Grenzen des
          Urheberrechts bedarf der vorherigen schriftlichen Zustimmung
          des jeweiligen Rechteinhabers.
        </p>

        <h2 className="font-display font-normal text-bark text-[1.3rem] mt-6">
          Streitbeilegung
        </h2>
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
          teilzunehmen.
        </p>
      </section>

      <footer className="pt-6 border-t border-mist text-[0.72rem] text-sage">
        Stand: Oktober 2026
      </footer>
    </div>
  );
}
