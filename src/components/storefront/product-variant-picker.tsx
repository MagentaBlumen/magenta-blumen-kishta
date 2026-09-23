"use client";

import { useState } from "react";
import { formatChf } from "@/lib/money";

type Variant = {
  id: number;
  sizeLabelDe: string | null;
  priceGross: string;
  salePriceGross: string | null;
  isAvailable: boolean;
};

/**
 * Size-pill variant selector + prominent price display.
 *
 * Selected variant drives the big price shown above the pills.
 * Sold-out variants render greyed and non-clickable (rule 7 . no
 * integer stock, availability is boolean; sold-out never hidden).
 *
 * Note: no add-to-cart wiring . that lands in Session 5. This
 * component's role today is visual + preparing the shape the cart
 * action will consume.
 */
export function ProductVariantPicker({ variants }: { variants: Variant[] }) {
  const firstAvailableIdx = variants.findIndex((v) => v.isAvailable);
  const initialIdx = firstAvailableIdx >= 0 ? firstAvailableIdx : 0;
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);

  if (variants.length === 0) {
    return (
      <div className="text-[0.85rem] text-sage">
        Zurzeit keine Varianten verfügbar.
      </div>
    );
  }

  const selected = variants[selectedIdx] ?? variants[0];
  const displayPrice = selected.salePriceGross ?? selected.priceGross;
  const hasSale =
    selected.salePriceGross !== null && selected.salePriceGross !== selected.priceGross;

  return (
    <>
      <div className="border-y border-mist py-5">
        <div className="flex items-baseline gap-3">
          <p className="font-display text-[2rem] font-normal text-bark tabular-nums leading-none">
            {formatChf(displayPrice)}
          </p>
          {hasSale && (
            <p className="text-[0.9rem] text-sage line-through tabular-nums">
              {formatChf(selected.priceGross)}
            </p>
          )}
        </div>
        <p className="text-[0.72rem] text-sage mt-1.5">
          Inkl. MwSt. · Lieferung im Aargau ab CHF 12
        </p>
      </div>

      {variants.length > 1 && (
        <div className="pt-6">
          <p className="text-[0.68rem] tracking-[0.12em] uppercase font-medium text-bark mb-2.5">
            Grösse
            {selected.sizeLabelDe && (
              <span className="text-sage font-normal tracking-normal normal-case ml-2">
                . {selected.sizeLabelDe}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {variants.map((v, i) => {
              const isSelected = i === selectedIdx;
              const isDisabled = !v.isAvailable;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => setSelectedIdx(i)}
                  className={`px-4 py-2.5 text-[0.72rem] tracking-[0.08em] uppercase font-medium border transition-colors ${
                    isSelected
                      ? "border-rose bg-rose text-ivory"
                      : "border-mist text-bark hover:border-bark"
                  } ${isDisabled ? "opacity-40 cursor-not-allowed line-through hover:border-mist" : "cursor-pointer"}`}
                >
                  {v.sizeLabelDe || "Standard"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
