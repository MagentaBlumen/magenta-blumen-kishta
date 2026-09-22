import Link from "next/link";

export type OccasionTileData = {
  slug: string;
  nameDe: string;
  imageUrl: string;
};

/**
 * Full-bleed image tile with bottom gradient + uppercase label.
 * Hover-scales the image slightly (like the Figma). Aspect-ratio 4:5.
 *
 * imageUrl for MVP is a stock Unsplash URL per occasion. When Sandra
 * supplies real photos for each occasion, swap them via the admin
 * (category table doesn't have an image field today; if we want
 * category-level imagery, that's a schema addition - CLAUDE.md
 * rule 2 flag first).
 */
export function OccasionTile({ occasion }: { occasion: OccasionTileData }) {
  return (
    <Link
      href={`/kategorie/${occasion.slug}`}
      className="group relative block overflow-hidden bg-mist"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={occasion.imageUrl}
        alt={occasion.nameDe}
        className="w-full aspect-[4/5] object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
      />
      <div
        className="absolute inset-x-0 bottom-0 pt-8 pb-5 px-5"
        style={{
          background:
            "linear-gradient(to top, rgba(42,31,26,0.65) 0%, transparent 100%)",
        }}
      >
        <span className="text-ivory text-[0.72rem] tracking-[0.16em] uppercase font-medium">
          {occasion.nameDe}
        </span>
      </div>
    </Link>
  );
}
