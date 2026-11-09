"use client";

import { useMemo, useState, useTransition } from "react";
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
 * Buy box: variant tiles → qty stepper → CTA with live total → free-
 * shipping progress hint.
 *
 * Variant tiles render as a grid with name + price per tile, mirroring
 * the mockup's size picker. Selected tile is bark-filled; unavailable
 * tiles are dimmed but still shown (rule 7 — sold-out visible, not
 * hidden).
 */
export function ProductVariantPicker({
  productId,
  variants,
  freeShippingThreshold = 120,
}: {
  productId: number;
  variants: Variant[];
  freeShippingThreshold?: number;
}) {
  const firstAvailableIdx = variants.findIndex((v) => v.isAvailable);
  const initialIdx = firstAvailableIdx >= 0 ? firstAvailableIdx : 0;
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<"idle" | "added" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selected = variants[selectedIdx] ?? variants[0];

  const { unitPriceNum, totalNum, hasSale } = useMemo(() => {
    if (!selected) return { unitPriceNum: 0, totalNum: 0, hasSale: false };
    const unit = Number(selected.salePriceGross ?? selected.priceGross);
    return {
      unitPriceNum: unit,
      totalNum: unit * qty,
      hasSale:
        selected.salePriceGross !== null &&
        selected.salePriceGross !== selected.priceGross,
    };
  }, [selected, qty]);

  if (variants.length === 0) {
    return (
      <div className="text-[0.85rem] text-sage">
        Zurzeit keine Varianten verfügbar.
      </div>
    );
  }

  const canBuy = selected.isAvailable && !isPending;
  const shortfallToFree = Math.max(0, freeShippingThreshold - totalNum);
  const willBeFree = totalNum >= freeShippingThreshold;

  function handleSelect(i: number) {
    if (!variants[i]?.isAvailable) return;
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
        setTimeout(() => setFeedback("idle"), 2200);
      } catch (err) {
        setFeedback("error");
        setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <div className="flex flex-col gap-7">
      {/* -------- Price -------- */}
      <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1">
        <span className="font-display text-[2rem] font-normal text-bark tabular-nums leading-none">
          {formatChf(selected.salePriceGross ?? selected.priceGross)}
        </span>
        {hasSale && (
          <span className="text-[0.95rem] text-sage line-through tabular-nums">
            {formatChf(selected.priceGross)}
          </span>
        )}
        <span className="text-[0.78rem] text-sage">inkl. MwSt.</span>
      </div>

      {/* -------- Size tiles -------- */}
      {variants.length > 1 && (
        <fieldset className="border-0 p-0 m-0 min-w-0">
          <legend className="text-[0.78rem] font-semibold text-bark mb-3">
            Grösse{" "}
            {selected.sizeLabelDe && (
              <span className="font-normal text-sage">
                — {selected.sizeLabelDe}
              </span>
            )}
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {variants.map((v, i) => {
              const isSelected = i === selectedIdx;
              const isDisabled = !v.isAvailable;
              const price = formatChf(v.salePriceGross ?? v.priceGross);
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelect(i)}
                  aria-pressed={isSelected}
                  className={`min-h-[64px] px-2 py-2 border rounded flex flex-col items-center justify-center gap-0.5 text-center transition-colors duration-150 ${
                    isSelected
                      ? "border-bark border-2 bg-bark text-ivory"
                      : isDisabled
                        ? "border-mist text-sage opacity-40 cursor-not-allowed line-through"
                        : "border-bark/20 text-bark hover:border-bark cursor-pointer"
                  }`}
                >
                  <span className="text-[0.85rem] font-semibold">
                    {v.sizeLabelDe || "Standard"}
                  </span>
                  <span
                    className={`text-[0.72rem] tabular-nums ${isSelected ? "text-ivory/85" : "text-sage"}`}
                  >
                    {price}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* -------- Qty + CTA -------- */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center border border-bark/20 rounded h-[56px]">
          <button
            type="button"
            onClick={() => handleQty(-1)}
            disabled={qty <= 1}
            aria-label="Menge verringern"
            className="w-12 h-full text-[1.4rem] text-bark hover:text-rose disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={99}
            value={qty}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setQty(Number.isFinite(n) ? Math.max(1, Math.min(99, n)) : 1);
            }}
            aria-label="Menge"
            className="w-10 h-full text-center text-[16px] font-semibold text-bark tabular-nums bg-transparent border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => handleQty(1)}
            disabled={qty >= 99}
            aria-label="Menge erhöhen"
            className="w-12 h-full text-[1.4rem] text-bark hover:text-rose disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            +
          </button>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canBuy}
          className={`flex-1 min-w-[220px] h-[56px] px-6 rounded text-[15px] font-semibold tracking-[0.02em] transition-all duration-200 ${
            feedback === "added"
              ? "bg-bark text-ivory"
              : "bg-rose text-ivory hover:brightness-90 active:translate-y-px"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {!selected.isAvailable
            ? "Ausverkauft"
            : isPending
              ? "Wird hinzugefügt ..."
              : feedback === "added"
                ? "✓ Zum Warenkorb hinzugefügt"
                : `In den Warenkorb · ${formatChf(totalNum.toFixed(2))}`}
        </button>
      </div>

      {/* Free-shipping hint */}
      {selected.isAvailable && unitPriceNum > 0 && (
        <p
          aria-live="polite"
          className="text-[13px] text-sage -mt-2"
        >
          {willBeFree
            ? "Diese Bestellung wird gratis geliefert."
            : `Noch ${formatChf(shortfallToFree.toFixed(2))} bis zur Gratis-Lieferung.`}
        </p>
      )}

      {feedback === "error" && errorMsg && (
        <p className="text-[0.85rem] text-rose">{errorMsg}</p>
      )}
    </div>
  );
}
