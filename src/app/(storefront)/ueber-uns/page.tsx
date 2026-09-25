import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Über uns",
  description:
    "Magenta Blumen . kleine Blumen-Werkstatt in Neuenhof AG. Von Hand gebundene Sträusse, Lieferung im Aargau, auch am Sonntag.",
  alternates: { canonical: "/ueber-uns" },
};

export default function UeberUnsPage() {
  return (
    <>
      {/* -------- Hero band -------- */}
      <section className="relative h-[260px] lg:h-[320px] overflow-hidden bg-mist">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/uber uns.jpg"
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(42,31,26,0.72) 0%, rgba(42,31,26,0.3) 55%, rgba(42,31,26,0.05) 100%)",
          }}
        />
        <div className="relative h-full max-w-7xl mx-auto px-4 lg:px-6 flex items-center">
          <div className="max-w-md">
            <p className="text-[0.68rem] tracking-[0.2em] uppercase text-blush font-medium mb-3">
              Über uns
            </p>
            <h1 className="font-display font-light text-cream text-[clamp(2.2rem,4vw,3.2rem)] leading-[1.1]">
              Kleine Werkstatt, <em>grosse Sorgfalt.</em>
            </h1>
          </div>
        </div>
      </section>

      {/* -------- Story block -------- */}
      <section className="max-w-3xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
        <div className="space-y-6 text-[0.95rem] text-bark/80 leading-[1.8] font-light">
          <p>
            Magenta Blumen ist ein kleiner Blumenladen an der Zürcherstrasse in
            Neuenhof. Wir sind eine Blumen-Werkstatt, kein Sortiment. Jeder
            Strauss entsteht von Hand, die Farben nach dem Auge der Inhaberin
            und nicht nach einem Katalog.
          </p>
          <p>
            Geliefert wird im eigenen Van, zwei Touren pro Tag, sieben Tage die
            Woche. Wer in einer unserer 27 Aargauer Postleitzahlen wohnt, hat
            die Blumen am selben Tag zu Hause. Auch am Sonntag.
          </p>
          <p>
            Sie erreichen uns telefonisch unter{" "}
            <a
              href="tel:+41565565609"
              className="text-bark border-b border-bark hover:text-rose hover:border-rose transition-colors"
            >
              056 556 56 09
            </a>{" "}
            oder mobil unter{" "}
            <a
              href="tel:+41763410232"
              className="text-bark border-b border-bark hover:text-rose hover:border-rose transition-colors"
            >
              076 341 02 32
            </a>
            .
          </p>
        </div>

        {/* -------- Facts strip -------- */}
        <dl className="mt-12 grid gap-6 md:grid-cols-3 border-t border-mist pt-10">
          <div>
            <dt className="text-[0.68rem] tracking-[0.14em] uppercase font-medium text-sage mb-2">
              Adresse
            </dt>
            <dd className="text-[0.9rem] text-bark leading-[1.6]">
              Magenta Blumen
              <br />
              Zürcherstrasse 142
              <br />
              5432 Neuenhof
            </dd>
          </div>
          <div>
            <dt className="text-[0.68rem] tracking-[0.14em] uppercase font-medium text-sage mb-2">
              Kontakt
            </dt>
            <dd className="text-[0.9rem] text-bark leading-[1.6]">
              056 556 56 09
              <br />
              076 341 02 32
              <br />
              info@magenta-blumen.ch
            </dd>
          </div>
          <div>
            <dt className="text-[0.68rem] tracking-[0.14em] uppercase font-medium text-sage mb-2">
              Lieferung
            </dt>
            <dd className="text-[0.9rem] text-bark leading-[1.6]">
              27 Aargauer PLZ
              <br />
              10:00–12:00 und 16:00–18:00
              <br />
              Auch am Sonntag
            </dd>
          </div>
        </dl>

        <div className="mt-12 pt-8 border-t border-mist flex flex-wrap gap-4">
          <Link
            href="/kategorie/alle-anlaesse"
            className="inline-block bg-bark text-ivory px-8 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose transition-colors"
          >
            Zum Sortiment
          </Link>
          <a
            href="tel:+41565565609"
            className="inline-block border border-bark text-bark px-8 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-bark hover:text-ivory transition-colors"
          >
            Anrufen
          </a>
        </div>
      </section>
    </>
  );
}
