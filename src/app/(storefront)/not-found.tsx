import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Nicht gefunden",
  robots: { index: false, follow: false },
};

/**
 * Storefront 404. Lives inside (storefront)/ so the header + footer
 * wrap it - a lost visitor still sees the shop's identity and can
 * navigate on.
 *
 * Any `notFound()` call from a page below this file routes here;
 * typos in product/category slugs are the common path.
 */
export default function StorefrontNotFound() {
  return (
    <div className="max-w-xl mx-auto px-4 lg:px-6 py-20 lg:py-28 text-center space-y-6">
      <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
        404
      </p>
      <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
        Diese Seite gibt es nicht.
      </h1>
      <p className="text-[0.9rem] text-bark/75 leading-[1.7] font-light">
        Vielleicht ist der Link alt oder die Blume ist aus dem Sortiment
        verschwunden. Beginnen Sie neu auf der Startseite oder stöbern Sie in
        den Kategorien.
      </p>
      <div className="pt-6 flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="inline-block bg-bark text-ivory px-9 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose transition-colors"
        >
          Zur Startseite
        </Link>
        <Link
          href="/kategorie/blumenstraeusse"
          className="inline-block border border-bark text-bark px-9 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-bark hover:text-ivory transition-colors"
        >
          Blumensträusse ansehen
        </Link>
      </div>
    </div>
  );
}
