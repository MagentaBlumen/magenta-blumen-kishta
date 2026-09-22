import Link from "next/link";

/**
 * 2-column editorial feature. Image left, story text right.
 * Real story about the shop, not the Figma's aspirational copy about
 * international sourcing.
 */
export function EditorialFeature() {
  return (
    <section className="max-w-7xl mx-auto px-4 lg:px-6 py-12 lg:py-20">
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1632839846357-9d9bb6681038?w=800&h=1000&fit=crop&auto=format"
            alt="Person hält einen Blumenstrauss"
            className="w-full block bg-mist aspect-[4/5] object-cover"
          />
          {/* Overlay badge with a quote */}
          <div className="absolute -bottom-4 right-4 bg-cream border border-mist px-6 py-4 max-w-[220px]">
            <p className="text-[0.75rem] text-bark leading-relaxed font-display italic">
              «Jeder Strauss von Hand — kein Sortiment, keine Massenware.»
            </p>
          </div>
        </div>
        <div className="space-y-5">
          <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
            Über uns
          </p>
          <h2 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
            Kleine Werkstatt,<br />
            <em>grosse Sorgfalt.</em>
          </h2>
          <div className="space-y-4 text-[0.9rem] text-bark/75 leading-[1.7] font-light">
            <p>
              Magenta Blumen ist ein kleiner Blumenladen in Neuenhof. Die
              Inhaberin bindet jeden Strauss selbst — die Farben entstehen
              nach ihrem Auge, nicht nach einem Katalog.
            </p>
            <p>
              Geliefert wird im eigenen Van, zwei Touren pro Tag,
              sieben Tage die Woche. Wer im Aargau wohnt, hat die Blumen
              am selben Tag zu Hause.
            </p>
          </div>
          <Link
            href="/ueber-uns"
            className="inline-block text-[0.7rem] tracking-[0.16em] uppercase font-medium text-bark border-b border-bark pb-0.5 hover:text-rose hover:border-rose transition-colors"
          >
            Mehr über uns →
          </Link>
        </div>
      </div>
    </section>
  );
}
