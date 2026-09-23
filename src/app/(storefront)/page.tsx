import Link from "next/link";
import type { Metadata } from "next";
import { Hero } from "@/components/storefront/hero";
import { TrustStrip } from "@/components/storefront/trust-strip";
import { OccasionTile } from "@/components/storefront/occasion-tile";
import { EditorialFeature } from "@/components/storefront/editorial-feature";
import { ProductCard } from "@/components/storefront/product-card";
import {
  getFeaturedProducts,
  getHomeOccasionCategories,
} from "@/lib/cached-storefront";

// Page renders dynamically per request (so Docker build works without a
// live DB), but the DB queries below live in unstable_cache with a 5-min
// TTL + tag-based invalidation. Effect: functionally equivalent to ISR
// - first request per window hits Postgres, subsequent renders in that
// window are cache hits. Admin edits call revalidateTag('products') to
// bust the cache immediately. See src/lib/cached-storefront.ts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // Root layout has a default title / description; the home page can
  // stay with those (they describe the shop itself). No override.
  alternates: {
    canonical: "/",
  },
};

// Hardcoded imagery for occasion tiles. When the category schema grows
// an image_url column we swap this for a DB read. Skipping the schema
// change until the design settles.
// Images for occasion tiles from /public/images.
const OCCASION_TILE_IMAGES: Record<string, string> = {
  geburtstag: "/images/birthday.jpg",
  liebe: "/images/valentines.jpeg",
  danke: "/images/danke.jpg",
  trauer: "/images/funeral.jpg",
};

const HOME_OCCASION_SLUGS = ["geburtstag", "liebe", "danke", "trauer"];

export default async function HomePage() {
  const [occasionRows, featured] = await Promise.all([
    getHomeOccasionCategories(HOME_OCCASION_SLUGS),
    getFeaturedProducts(),
  ]);

  const occasionsInOrder = HOME_OCCASION_SLUGS.flatMap((slug) => {
    const row = occasionRows.find((r) => r.slug === slug);
    if (!row) return [];
    return [
      {
        slug: row.slug,
        nameDe: row.nameDe,
        imageUrl: OCCASION_TILE_IMAGES[row.slug] ?? "",
      },
    ];
  });

  return (
    <>
      <Hero />
      <TrustStrip />

      {/* -------- Featured products -------- */}
      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-10 lg:mb-14 gap-6">
          <div>
            <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium mb-3">
              Aktuell im Laden
            </p>
            <h2 className="font-display font-light text-bark text-[clamp(2rem,4vw,3.2rem)] leading-[1.1]">
              Die schönsten Blumen<br />
              <em>dieser Woche</em>
            </h2>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "Alle", href: "/kategorie/alle-anlaesse" },
              { label: "Blumensträusse", href: "/kategorie/blumenstraeusse" },
              { label: "Rosen", href: "/kategorie/rosen" },
              { label: "Zimmerpflanzen", href: "/kategorie/zimmerpflanzen" },
              { label: "Trockenblumen", href: "/kategorie/trockenblumen" },
            ].map((f) => (
              <Link
                key={f.label}
                href={f.href}
                className="px-5 py-2 text-[0.68rem] tracking-[0.12em] uppercase font-medium border border-mist text-bark hover:border-bark hover:bg-bark hover:text-ivory transition-colors"
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {featured.length === 0 ? (
          <div className="border border-dashed border-mist p-12 text-center text-sage text-[0.85rem]">
            Noch keine Produkte im Shop. Kommen Sie bald wieder vorbei.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
            {featured.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* -------- Occasion tiles -------- */}
      <section className="bg-cream py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 lg:px-6">
          <div className="text-center mb-10 lg:mb-14">
            <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium mb-3">
              Nach Anlass shoppen
            </p>
            <h2 className="font-display font-light text-bark text-[clamp(1.8rem,3.5vw,2.8rem)] leading-[1.1]">
              Blumen für jeden <em>besonderen Moment</em>
            </h2>
          </div>
          <div className="hidden lg:grid lg:grid-cols-4 gap-3">
            {occasionsInOrder.map((occ) => (
              <OccasionTile key={occ.slug} occasion={occ} />
            ))}
          </div>
          <div className="lg:hidden flex gap-3 overflow-x-auto pb-2" style={{ scrollSnapType: "x mandatory" }}>
            {occasionsInOrder.map((occ) => (
              <div key={occ.slug + "-m"} className="flex-shrink-0 w-40" style={{ scrollSnapAlign: "start" }}>
                <OccasionTile occasion={occ} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------- Editorial feature -------- */}
      <EditorialFeature />
    </>
  );
}
