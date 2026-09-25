"use client";

import { useState, useTransition } from "react";
import { formatChf } from "@/lib/money";
import { addToCartAction } from "@/lib/cart/actions";

type Variant = {
  id: number;
  sizeLabelDe: string | null;
  priceGross: string;
  salePriceGross: string | null;
  isAvailable: boolean;
};

/**
 * Size-pill variant selector + prominent price display + qty stepper +
 * add-to-cart button. This is the whole purchase panel on the product
 * detail page.
 *
 * Sold-out variants render greyed and non-clickable (rule 7 . no
 * integer stock, availability is boolean; sold-out never hidden).
 * The Add button disables while the current variant is unavailable.
 *
 * State lives here (not lifted) because nothing outside the panel
 * needs to know which size / qty is selected until the moment a line
 * hits the cookie. Server action is called via useTransition so the
 * button can show a pending state without blocking the UI.
 */
export function ProductVariantPicker({
  productId,
  variants,
}: {
  productId: number;
  variants: Variant[];
}) {
  const firstAvailableIdx = variants.findIndex((v) => v.isAvailable);
  const initialIdx = firstAvailableIdx >= 0 ? firstAvailableIdx : 0;
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<"idle" | "added" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  // TODO(sandra): decide whether variant.is_available=false blocks
  // ordering entirely, or only means "not available for today's runs".
  // For a made-to-order florist delivering days ahead, a bouquet marked
  // unavailable today could reasonably be orderable for next Tuesday.
  //
  // Current behaviour: UI disables Add. This is a placeholder decision.
  // The cookie / server action already allow is_available=false lines
  // in the cart per rule 7 - only the button here blocks. Flip the
  // canBuy line below (drop the isAvailable check) if Sandra prefers
  // "sold-out today but still orderable for a future slot".
  const canBuy = selected.isAvailable && !isPending;

  function handleSelect(i: number) {
    setSelectedIdx(i);
    setFeedback("idle");
    setErrorMsg(null);
  }

  function handleQty(delta: number) {
    setQty((q) => Math.max(1, Math.min(99, q + delta)));
    setFeedback("idle");
    setErrorMsg(null);
  }

  function handleAdd() {
    if (!canBuy) return;
    setFeedback("idle");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await addToCartAction(productId, selected.id, qty);
        setFeedback("added");
        // Reset the visible feedback after a moment, but leave the
        // cart badge count (rendered by the server layout) alone.
        setTimeout(() => setFeedback("idle"), 2200);
      } catch (err) {
        setFeedback("error");
        setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <>
      {/* -------- Price block -------- */}
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

      {/* -------- Size pills -------- */}
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
                  onClick={() => handleSelect(i)}
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

      {/* -------- Qty + Add -------- */}
      <div className="pt-6 flex flex-col sm:flex-row gap-3">
        <div className="flex items-center border border-mist h-[50px] flex-shrink-0">
          <button
            type="button"
            onClick={() => handleQty(-1)}
            disabled={qty <= 1}
            aria-label="Menge verringern"
            className="w-11 h-full text-[1.2rem] text-bark hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="w-9 text-center text-[0.88rem] font-medium text-bark tabular-nums"
          >
            {qty}
          </span>
          <button
            type="button"
            onClick={() => handleQty(1)}
            disabled={qty >= 99}
            aria-label="Menge erhöhen"
            className="w-11 h-full text-[1.2rem] text-bark hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canBuy}
          className={`flex-1 h-[50px] px-6 text-[0.72rem] tracking-[0.16em] uppercase font-medium transition-colors ${
            feedback === "added"
              ? "bg-bark text-ivory"
              : "bg-rose text-ivory hover:bg-[#831249]"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {!selected.isAvailable
            ? "Ausverkauft"
            : isPending
              ? "Wird hinzugefügt ..."
              : feedback === "added"
                ? "✓ Zum Warenkorb hinzugefügt"
                : "In den Warenkorb"}
        </button>
      </div>

      {feedback === "error" && errorMsg && (
        <p className="pt-3 text-[0.78rem] text-rose">{errorMsg}</p>
      )}
    </>
  );
}
