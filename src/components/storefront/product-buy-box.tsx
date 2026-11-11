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
 * New PDP buy box — numbered steps + visual size tiles + dark
 * summary slab with live total and free-shipping progress bar.
 *
 * Grusskarte and Extras steps from the mockup are DEFERRED — they
 * need cart/cookie plumbing that's bigger than this visual port. If
 * a product has a single variant the step title still reads "01" so
 * the flow visually matches when more steps are added later.
 */
export function ProductBuyBox({
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

  const { totalNum } = useMemo(() => {
    if (!selected) return { totalNum: 0 };
    const unit = Number(selected.salePriceGross ?? selected.priceGross);
    return { totalNum: unit * qty };
  }, [selected, qty]);

  if (variants.length === 0) {
    return (
      <div className="text-[0.85rem] text-sage">
        Zurzeit keine Varianten verfügbar.
      </div>
    );
  }

  const canBuy = selected.isAvailable && !isPending;
  const progressPct = Math.min(
    100,
    Math.round((totalNum / freeShippingThreshold) * 100),
  );
  const shortfall = Math.max(0, freeShippingThreshold - totalNum);

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

  // Visual size indicator sizes (larger variant → larger circle).
  const shapeSizes = [28, 52, 80];

  return (
    <div className="flex flex-col">
      {/* ---- 01 Grösse ---- */}
      {variants.length > 1 ? (
        <fieldset className="border-0 p-0 m-0 min-w-0 border-b border-[#E8DED3] py-7">
          <legend className="float-left w-full mb-4 p-0 inline-flex items-baseline gap-3">
            <span className="font-display text-[14px] text-rose min-w-[20px]">
              01
            </span>
            <span className="text-[15px] font-semibold text-bark">
              Wie gross darf es sein?
            </span>
          </legend>
          <div className="clear-both grid grid-cols-3 gap-2.5">
            {variants.map((v, i) => {
              const isSelected = i === selectedIdx;
              const isDisabled = !v.isAvailable;
              const size = shapeSizes[Math.min(i, shapeSizes.length - 1)];
              const price = formatChf(
                v.salePriceGross ?? v.priceGross,
              ).replace(".00", "");
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelect(i)}
                  aria-pressed={isSelected}
                  className={`h-full px-2.5 pt-[18px] pb-4 flex flex-col items-center gap-2.5 border transition-all duration-150 ${
                    isSelected
                      ? "border-rose bg-white shadow-[0_0_0_1px_var(--color-rose),0_8px_20px_rgba(163,22,95,0.1)]"
                      : isDisabled
                        ? "border-mist opacity-40 cursor-not-allowed line-through"
                        : "border-[#E2D6C9] hover:border-bark/30 cursor-pointer"
                  }`}
                >
                  <span className="h-[84px] flex items-end justify-center">
                    <span
                      aria-hidden
                      className="transition-colors duration-150"
                      style={{
                        width: size,
                        height: size,
                        borderRadius: "50% 50% 46% 46%",
                        background: isSelected ? "#6D52A8" : "#DCCFC2",
                        boxShadow: isSelected
                          ? "inset -6px -6px 0 rgba(0,0,0,0.12)"
                          : undefined,
                      }}
                    />
                  </span>
                  <span className="text-[14px] font-semibold text-bark">
                    {v.sizeLabelDe || "Standard"}
                  </span>
                  <span
                    className={`font-display text-[19px] ${
                      isSelected ? "text-bark" : "text-sage"
                    }`}
                  >
                    {price}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      {/* ---- Dark summary slab ---- */}
      <div className="bg-bark text-ivory p-6 flex flex-col gap-[18px] mt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[13px] text-[#CBBDB2]">
              {qty} × {selected.sizeLabelDe || "Standard"}
            </span>
            <span className="font-display text-[36px] leading-none text-ivory tabular-nums">
              {formatChf(totalNum.toFixed(2))}
            </span>
          </div>
          <div className="flex items-center border border-[#5C4A46] h-11">
            <button
              type="button"
              onClick={() => handleQty(-1)}
              disabled={qty <= 1}
              aria-label="Menge verringern"
              className="w-11 h-full text-[18px] text-ivory hover:text-rose disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
              className="w-8 text-center text-[15px] font-semibold text-ivory tabular-nums bg-transparent border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onClick={() => handleQty(1)}
              disabled={qty >= 99}
              aria-label="Menge erhöhen"
              className="w-11 h-full text-[18px] text-ivory hover:text-rose disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canBuy}
          className={`h-14 text-[16px] font-semibold tracking-[0.02em] transition-all duration-200 ${
            feedback === "added"
              ? "bg-ivory text-bark"
              : "bg-rose text-ivory hover:brightness-110 active:translate-y-px"
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

        {/* Free-shipping progress bar */}
        {selected.isAvailable && (
          <div className="flex flex-col gap-2">
            <div className="h-1 bg-[#4A3A37] overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span
              aria-live="polite"
              className="text-[13px] text-[#E9DFD5]"
            >
              {totalNum >= freeShippingThreshold
                ? "Gratis-Lieferung inklusive"
                : `Noch ${formatChf(shortfall.toFixed(2))} bis zur Gratis-Lieferung`}
            </span>
          </div>
        )}

        {feedback === "error" && errorMsg && (
          <p className="text-[13px] text-rose">{errorMsg}</p>
        )}
      </div>

      {/* ---- Trust line ---- */}
      <p className="mt-[18px] flex flex-wrap justify-center items-center gap-x-3.5 gap-y-1.5 text-[13px] text-sage">
        <span>Eigener Van, kein Kurier</span>
        <span aria-hidden>·</span>
        <span>Auch am Sonntag</span>
        <span aria-hidden>·</span>
        <span>TWINT &amp; Karte</span>
      </p>
    </div>
  );
}
