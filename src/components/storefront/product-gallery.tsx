"use client";

import { useState } from "react";
import { largeUrl, thumbUrl } from "@/lib/image-urls";

type Image = {
  id: number;
  url: string;
  altDe: string | null;
};

/**
 * Product-detail gallery. Vertical thumbnail strip on the left + one
 * big main image on the right. Clicking a thumb swaps the main image.
 *
 * Layout collapses on mobile: thumbs move under the main image as a
 * horizontal scroll row. The Figma has 3/4 portrait aspect for the
 * main image . bouquets and stems photograph tall.
 */
export function ProductGallery({
  images,
  productName,
  showSoldOut,
}: {
  images: Image[];
  productName: string;
  showSoldOut: boolean;
}) {
  const [selected, setSelected] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] w-full bg-mist flex items-center justify-center text-[0.72rem] uppercase tracking-[0.14em] text-sage">
        Kein Bild
      </div>
    );
  }

  const active = images[selected] ?? images[0];

  return (
    <div className="flex flex-col-reverse md:flex-row gap-3">
      {images.length > 1 && (
        <div className="flex md:flex-col gap-2 md:flex-shrink-0 overflow-x-auto md:overflow-visible">
          {images.map((img, i) => {
            const isActive = i === selected;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setSelected(i)}
                aria-label={`Bild ${i + 1} anzeigen`}
                aria-current={isActive ? "true" : undefined}
                className={`w-[72px] h-[90px] flex-shrink-0 bg-mist overflow-hidden border-2 transition-colors ${
                  isActive ? "border-rose" : "border-transparent hover:border-mist"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbUrl(img.url)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>
      )}

      <div className="relative flex-1 bg-mist overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={largeUrl(active.url)}
          alt={active.altDe ?? productName}
          className="w-full aspect-[3/4] object-cover block"
        />
        {showSoldOut && (
          <span className="absolute top-4 right-4 bg-ivory/95 text-bark text-[0.68rem] tracking-[0.14em] uppercase font-medium px-3 py-1.5">
            Ausverkauft
          </span>
        )}
      </div>
    </div>
  );
}
