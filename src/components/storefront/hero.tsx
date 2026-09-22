import Link from "next/link";

/**
 * Hero section - full-bleed image with gradient overlay + serif h1 with
 * italic word emphasis + subtitle + CTA button.
 *
 * TODO: swap hero image for a real photo of Sandra's shop or her
 * arrangements once she can supply one. Currently uses a stock image
 * from Unsplash (licensed for commercial use without attribution).
 */
export function Hero() {
  return (
    <section className="relative min-h-[min(92vh,700px)] overflow-hidden bg-mist flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.unsplash.com/photo-1782038522759-d4e76b087a8f?w=1800&h=1100&fit=crop&auto=format"
        alt="Frische Blumen in einem Blumenladen"
        className="absolute inset-0 w-full h-full object-cover object-[center_top]"
      />
      {/* Left-to-right ivory gradient so text on the left stays readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to right, rgba(253,252,249,0.88) 0%, rgba(253,252,249,0.55) 50%, rgba(253,252,249,0.1) 100%)",
        }}
      />
      <div className="relative max-w-[560px] px-5 sm:px-10 lg:px-20 py-16 sm:py-20">
        <h1 className="font-display font-light leading-[1.05] text-bark mb-5 text-[clamp(2.6rem,7vw,5.5rem)] tracking-[-0.01em]">
          Frische Blumen aus
          <br />
          <em>Neuenhof,</em>
          <br />
          von Hand gebunden.
        </h1>
        <p className="text-[0.9rem] text-bark/70 leading-[1.7] mb-8 font-light">
          Kleine Blumen-Werkstatt in Neuenhof AG.
          <br />
          Lieferung in 27 Aargauer Postleitzahlen — mit unserem eigenen Van, auch am Sonntag.
        </p>
        <Link
          href="/kategorie/alle-anlaesse"
          className="inline-block bg-bark text-ivory px-9 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose transition-colors"
        >
          Jetzt bestellen
        </Link>
      </div>
    </section>
  );
}
