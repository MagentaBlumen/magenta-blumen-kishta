import type { Metadata } from "next";
import { LegalDraftBanner } from "@/components/storefront/legal-draft-banner";

export const metadata: Metadata = {
  title: "AGB",
  description:
    "Allgemeine Geschäftsbedingungen von Magenta Blumen für Bestellungen über magenta-blumen.ch.",
  alternates: { canonical: "/agb" },
};

/**
 * Starter AGB covering the business rules already baked into the code:
 *   - 27 PLZ delivery zone (docs/delivery-zones.md)
 *   - Two runs per day + Sunday (catalogue-and-date-logic.md)
 *   - 3-hour cutoff / Tuesday 24h
 *   - Minimum order CHF 40 on subtotal (CLAUDE.md rule 6)
 *   - Substitution clause
 *   - "Nobody home" three options (catalogue doc)
 *   - Hospital exclusion (no soil, no intensive care)
 *   - Payment methods
 *
 * Lawyer should review the liability + cancellation sections in
 * particular. "Verderbliche Ware" (perishable goods) exception to the
 * 14-day withdrawal right needs sign-off.
 */
export default function AgbPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-10 lg:py-14 space-y-8">
      <LegalDraftBanner />

      <header className="space-y-2">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
          Rechtliches
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
          Allgemeine Geschäftsbedingungen
        </h1>
      </header>

      <section className="space-y-6 text-[0.92rem] text-bark/80 leading-[1.75] font-light">
        <Clause n="1" title="Geltungsbereich">
          <p>
            Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle
            Bestellungen von Blumen, Pflanzen und Zusatzartikeln über
            magenta-blumen.ch bei Magenta Blumen - Kishta
            (Geschäftsbezeichnung Magenta Blumen), Zürcherstrasse 142,
            5432 Neuenhof. Mit der Bestellung erklärt sich der Kunde
            mit den AGB einverstanden.
          </p>
        </Clause>

        <Clause n="2" title="Produkte und Darstellung (Substitution)">
          <p>
            Alle Sträusse werden von Hand gebunden. Die abgebildeten
            Produkte sind <strong>beispielhafte Darstellungen</strong>
            und werden saisonal und nach Verfügbarkeit zusammengestellt.
            Form, Grösse und Farbgebung orientieren sich an der Abbildung;
            einzelne Blüten, Blattwerk und Füllgrün können davon
            abweichen, wenn eine abgebildete Sorte an einem Tag nicht in
            der nötigen Qualität verfügbar ist.
          </p>
          <p>
            Diese saisonale Substitution ist Bestandteil des
            handgebundenen Charakters und begründet keinen
            Reklamationsgrund, solange der Gesamteindruck — Stil,
            Farbfamilie, Grössenklasse — dem bestellten Produkt
            entspricht. Bei einem offensichtlich abweichenden Ergebnis
            gelten die Reklamationsregeln aus §10.
          </p>
        </Clause>

        <Clause n="3" title="Preise">
          <p>
            Alle Preise verstehen sich in Schweizer Franken (CHF)
            inklusive der gesetzlichen Mehrwertsteuer. Die Liefergebühr
            wird separat ausgewiesen und ist abhängig von der Lieferzone.
          </p>
        </Clause>

        <Clause n="4" title="Mindestbestellwert">
          <p>
            Der Mindestbestellwert für eine Lieferung beträgt{" "}
            <strong>CHF 40.00</strong>, berechnet auf die
            Produkt-Zwischensumme (ohne Kartentext und ohne
            Liefergebühr). Einzelne Zonen (zum Beispiel Brugg Stadt)
            haben einen abweichenden Mindestbestellwert von
            CHF 50.00. Der für Ihre Adresse geltende Mindestbestellwert
            wird nach Eingabe der Postleitzahl im Bestellvorgang
            angezeigt. Für Abholungen im Laden gilt kein
            Mindestbestellwert.
          </p>
        </Clause>

        <Clause n="5" title="Liefergebiet und Lieferzeiten">
          <p>
            Wir liefern mit unserem eigenen Van in 27 Postleitzahlen im
            Kanton Aargau (und einige angrenzende Zürcher Gemeinden). Die
            vollständige Liste wird im Bestellvorgang nach Eingabe der
            Postleitzahl angezeigt. Für Adressen ausserhalb dieses
            Gebiets ist eine Lieferung aktuell nicht möglich.
          </p>
          <p>
            Es gibt täglich zwei Zeitfenster:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Vormittag 10:00 – 12:00 Uhr</li>
            <li>Nachmittag 16:00 – 18:00 Uhr</li>
          </ul>
          <p>
            Lieferungen erfolgen an sieben Tagen die Woche, einschliesslich
            Sonntag. Dienstags ist der Laden geschlossen; Dienstagslieferungen
            sind möglich, müssen aber mindestens 24 Stunden im Voraus
            bestellt werden. An anderen Wochentagen beträgt die
            Vorlaufzeit mindestens 3 Stunden vor Beginn des gewählten
            Zeitfensters.
          </p>
          <p>
            Bestellungen können bis zu einem Monat im Voraus aufgegeben
            werden.
          </p>
        </Clause>

        <Clause n="6" title="Trauer- und Event-Lieferungen">
          <p>
            Für Beerdigungen, Hochzeiten und Veranstaltungen bieten wir
            Lieferungen zu einem genauen Zeitpunkt an (Zeremonienzeit).
            Wir liefern in diesem Fall rund eine Stunde vor der genannten
            Zeit. Maximal drei solcher Lieferungen pro Stunde sind
            möglich. Für Hochzeiten und ganze Trauerfloristik ausserhalb
            des Online-Shops kontaktieren Sie uns bitte direkt.
          </p>
        </Clause>

        <Clause n="7" title="Lieferung ins Spital">
          <p>
            Lieferungen in Spitäler sind nur als handgebundene Sträusse
            möglich (keine Gestecke mit Erde oder Steckschaum, aus
            Hygienegründen). Lieferungen auf Intensivstationen sind nicht
            möglich. Bitte geben Sie Station und Zimmer im Bestellvorgang
            an. Wir übernehmen keine Haftung, falls das Spital die
            Annahme verweigert; in diesem Fall wird der Strauss an die
            Rezeption übergeben oder in den Laden zurückgenommen.
          </p>
        </Clause>

        <Clause n="8" title="Zustellung – niemand zu Hause">
          <p>
            Trifft unsere Fahrerin niemanden an, so gilt die bei der
            Bestellung gewählte Option:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Übergabe an eine Drittperson</strong> (Nachbar,
              Rezeption). Wir dokumentieren, an wen übergeben wurde.
            </li>
            <li>
              <strong>Ablage an der Haustür.</strong> In diesem Fall
              trägt der Käufer das Risiko für Diebstahl, Beschädigung
              oder Verderb. Eine Haftung durch Magenta Blumen ist
              ausgeschlossen.
            </li>
            <li>
              <strong>Rückhaltung im Laden für zwei Tage.</strong> Die
              Bestellung kann in dieser Zeit abgeholt werden; danach wird
              der Strauss aus Frischegründen verwertet und der Preis
              nicht erstattet.
            </li>
          </ul>
        </Clause>

        <Clause n="9" title="Zahlung">
          <p>
            Folgende Zahlungsarten stehen zur Verfügung:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Kreditkarte</strong> (Visa, Mastercard, American
              Express) über unseren Zahlungsdienstleister Stripe.
            </li>
            <li>
              <strong>TWINT</strong> über Stripe.
            </li>
            <li>
              <strong>Rechnung.</strong> Die Rechnung wird per E-Mail
              zugestellt; Zahlungsziel 30 Tage ab Rechnungsdatum.
            </li>
            <li>
              <strong>Barzahlung</strong> bei Abholung im Laden oder an
              der Haustür an die Fahrerin.
            </li>
          </ul>
        </Clause>

        <Clause n="10" title="Reklamationen und Rückerstattung">
          <p>
            Blumen und Pflanzen sind <strong>verderbliche Ware, die auf
            individuelle Bestellung angefertigt wird</strong>. Ein
            allgemeines Widerrufsrecht nach schweizerischem Konsumrecht
            besteht für frisch gelieferte Sträusse und Pflanzen nicht.
          </p>
          <p>
            Reklamationen wegen Transportschäden oder offensichtlicher
            Mängel sind <strong>innerhalb von 24 Stunden nach Lieferung</strong>{" "}
            per Telefon (056 556 56 09) oder E-Mail
            (info@magenta-blumen.ch) zu melden. Hilfreich für die
            Bearbeitung ist ein Foto des beanstandeten Straussen.
          </p>
          <p>
            Wir prüfen jede Reklamation einzeln und bieten im
            Einvernehmen eine der folgenden Lösungen an:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nachlieferung eines Ersatzproduktes</li>
            <li>
              Teil- oder Vollerstattung auf die ursprüngliche
              Zahlungsart (Karte oder TWINT: in der Regel innerhalb von
              10 Werktagen bei Stripe; Rechnung: Gutschrift auf der
              offenen Forderung; Barzahlung: Rückzahlung im Laden)
            </li>
            <li>Gutschrift für eine spätere Bestellung</li>
          </ul>
          <p>
            Kommt eine Lieferung aus Gründen zustande, die wir zu
            vertreten haben (z. B. Fahrzeugausfall, Fehler bei der
            Vorbereitung), erstatten wir den vollen Bestellwert inklusive
            Liefergebühr.
          </p>
        </Clause>

        <Clause n="11" title="Stornierung durch den Kunden">
          <p>
            Stornierungen sind <strong>kostenlos möglich, solange die
            Bestellung noch nicht in Produktion gegangen ist</strong>.
            In der Praxis bedeutet das:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              bis mindestens <strong>3 Stunden vor dem gewählten
              Zeitfenster</strong> an Montag, Mittwoch, Donnerstag,
              Freitag, Samstag und Sonntag;
            </li>
            <li>
              bis mindestens <strong>24 Stunden vor dem Zeitfenster</strong>{" "}
              für Dienstagslieferungen (an diesem Tag ist der Laden
              geschlossen).
            </li>
          </ul>
          <p>
            Rückerstattungen bei fristgerechter Stornierung erfolgen nach
            den unter §10 genannten Regeln. Nach Produktionsbeginn ist
            eine Stornierung nicht mehr möglich, da die Blumen bereits
            bearbeitet wurden; eine Rückerstattung kommt dann nur in
            Betracht, wenn die Lieferung aus Gründen auf unserer Seite
            nicht zustande kommt.
          </p>
        </Clause>

        <Clause n="12" title="Haftungsbeschränkung">
          <p>
            Die Haftung von Magenta Blumen ist auf den Rechnungsbetrag
            der betroffenen Bestellung beschränkt. Die Haftung für
            Folgeschäden, entgangenen Gewinn oder immaterielle Schäden
            ist ausgeschlossen. Zwingende gesetzliche Haftungsgründe
            bleiben vorbehalten.
          </p>
        </Clause>

        <Clause n="13" title="Datenschutz">
          <p>
            Die Verarbeitung personenbezogener Daten im Rahmen der
            Bestellabwicklung ist in unserer{" "}
            <a href="/datenschutz" className="text-rose hover:underline">
              Datenschutzerklärung
            </a>{" "}
            geregelt.
          </p>
        </Clause>

        <Clause n="14" title="Anwendbares Recht und Gerichtsstand">
          <p>
            Es gilt ausschliesslich schweizerisches Recht unter Ausschluss
            des UN-Kaufrechts (CISG). Gerichtsstand ist Baden AG,
            soweit gesetzlich zulässig.
          </p>
        </Clause>
      </section>

      <footer className="pt-6 border-t border-mist text-[0.72rem] text-sage">
        Stand: Oktober 2026
      </footer>
    </div>
  );
}

function Clause({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="font-display font-normal text-bark text-[1.15rem] leading-tight">
        <span className="text-sage mr-2 tabular-nums">§{n}</span>
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
