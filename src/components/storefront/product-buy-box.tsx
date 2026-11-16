"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatChf } from "@/lib/money";
import { thumbUrl } from "@/lib/image-urls";
import {
  addToCartAction,
  addToCartWithAddonsAction,
} from "@/lib/cart/actions";
import type { AddonChoice } from "@/lib/cart/addons";

type Variant = {
  id: number;
  sizeLabelDe: string | null;
  priceGross: string;
  salePriceGross: string | null;
  isAvailable: boolean;
};

// Grusskarte + Extras live in /kasse, not here. They're order-level
// concerns (one card per delivery, addons apply to the whole order),
// so pricing/plumbing stays server-side where the real total is known.
// Progress toward CHF 120 free shipping also belongs on the cart /
// checkout side for the same reason — PDP only knows this one line.
export function ProductBuyBox({
  productId,
  variants,
  addons = [],
}: {
  productId: number;
  variants: Variant[];
  addons?: AddonChoice[];
}) {
  const firstAvailableIdx = variants.findIndex((v) => v.isAvailable);
  const initialIdx = firstAvailableIdx >= 0 ? firstAvailableIdx : 0;
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [qty, setQty] = useState(1);
  const [feedback, setFeedback] = useState<"idle" | "added" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [stickyVisible, setStickyVisible] = useState(false);
  const [addonsOpen, setAddonsOpen] = useState(false);
  const [pickedAddonIds, setPickedAddonIds] = useState<Set<number>>(
    () => new Set(),
  );
  const summaryRef = useRef<HTMLDivElement | null>(null);

  // Mobile sticky buy bar — shows once the dark summary slab scrolls out
  // of view so the customer can always see the total and reach "In den
  // Warenkorb" with their thumb.
  useEffect(() => {
    const el = summaryRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        setStickyVisible(!first.isIntersecting);
      },
      { threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const selected = variants[selectedIdx] ?? variants[0];

  const pickedAddons = useMemo(
    () => addons.filter((a) => pickedAddonIds.has(a.productId)),
    [addons, pickedAddonIds],
  );

  const { totalNum, addonsTotal } = useMemo(() => {
    if (!selected) return { totalNum: 0, addonsTotal: 0 };
    const unit = Number(selected.salePriceGross ?? selected.priceGross);
    const addonsUnit = pickedAddons.reduce(
      (acc, a) => acc + Number(a.priceGross),
      0,
    );
    const total = (unit + addonsUnit) * qty;
    return { totalNum: total, addonsTotal: addonsUnit * qty };
  }, [selected, qty, pickedAddons]);

  if (variants.length === 0) {
    return (
      <div className="text-[0.85rem] text-sage">
        Zurzeit keine Varianten verfügbar.
      </div>
    );
  }

  const canBuy = selected.isAvailable && !isPending;

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

  function toggleAddon(a: AddonChoice) {
    setPickedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(a.productId)) next.delete(a.productId);
      else next.add(a.productId);
      return next;
    });
    setFeedback("idle");
    setErrorMsg(null);
  }

  function handleAdd() {
    if (!canBuy) return;
    setFeedback("idle");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        if (pickedAddons.length === 0) {
          await addToCartAction(productId, selected.id, qty);
        } else {
          await addToCartWithAddonsAction(
            productId,
            selected.id,
            qty,
            pickedAddons.map((a) => ({
              productId: a.productId,
              variantId: a.variantId,
            })),
          );
        }
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
          <legend className="float-left w-full mb-4 p-0">
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
                      className="transition-colors duration-150 rounded-full"
                      style={{
                        width: size,
                        height: size,
                        background: isSelected
                          ? "var(--color-rose)"
                          : "#B8916A",
                      }}
                    />
                  </span>
                  <span className="font-display text-[19px] leading-[1.1] text-bark">
                    {v.sizeLabelDe || "Standard"}
                  </span>
                  <span
                    className={`text-[14px] ${
                      isSelected
                        ? "text-bark font-semibold"
                        : "text-sage"
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

      {/* ---- Noch etwas dazu? (add-ons) ---- */}
      {addons.length > 0 && (
        <div className="border-b border-[#E8DED3] py-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setAddonsOpen((v) => !v)}
            aria-expanded={addonsOpen}
            aria-controls="pdp-addons"
            className="flex items-center justify-between w-full text-left"
          >
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-bark">
                Noch etwas dazu?
              </span>
              <span className="text-[13px] text-sage">
                {pickedAddons.length === 0
                  ? "Optional · Pralinen, Duftkerze, Karte …"
                  : pickedAddons.map((a) => a.nameDe).join(" · ") +
                    ` · + ${formatChf(addonsTotal.toFixed(2))}`}
              </span>
            </span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className={`shrink-0 text-sage transition-transform duration-200 motion-reduce:transition-none ${
                addonsOpen ? "rotate-180" : ""
              }`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {addonsOpen && (
            <ul
              id="pdp-addons"
              className="list-none m-0 p-0 flex flex-col gap-2"
            >
              {addons.map((a) => {
                const checked = pickedAddonIds.has(a.productId);
                return (
                  <li key={a.productId}>
                    <label
                      className={`flex items-center gap-3 p-2.5 border cursor-pointer transition-colors ${
                        checked
                          ? "border-rose bg-[#FDF2F6]"
                          : "border-mist hover:border-oak"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleAddon(a)}
                      />
                      {a.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbUrl(a.imageUrl)}
                          alt=""
                          className="w-14 h-14 object-cover shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-cream shrink-0" />
                      )}
                      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[14px] font-semibold text-bark truncate">
                          {a.nameDe}
                        </span>
                        <span className="text-[13px] text-sage">
                          + {formatChf(a.priceGross)}
                        </span>
                      </span>
                      <span
                        aria-hidden
                        className={`shrink-0 w-6 h-6 border-[1.5px] grid place-items-center text-ivory text-[13px] font-bold ${
                          checked
                            ? "bg-rose border-rose"
                            : "border-oak bg-white"
                        }`}
                      >
                        {checked ? "✓" : ""}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ---- Dark summary slab ---- */}
      <div
        ref={summaryRef}
        className="mb-wood p-6 flex flex-col gap-[18px] mt-7"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[13px] text-[#D9C4A8]">
              {qty} × {selected.sizeLabelDe || "Standard"}
              {pickedAddons.length > 0
                ? ` + ${pickedAddons.length} ${pickedAddons.length === 1 ? "Extra" : "Extras"}`
                : ""}
            </span>
            <span className="font-display text-[36px] leading-none text-ivory tabular-nums">
              {formatChf(totalNum.toFixed(2))}
            </span>
          </div>
          <div className="flex items-center border border-[#6E5440] h-11">
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
              className="w-8 text-center text-[16px] font-semibold text-ivory tabular-nums bg-transparent border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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

        {feedback === "error" && errorMsg && (
          <p className="text-[13px] text-rose">{errorMsg}</p>
        )}
      </div>

      {/* ---- Mobile sticky buy bar — appears when summary scrolls off ---- */}
      <div
        aria-hidden={!stickyVisible}
        className={`lg:hidden fixed inset-x-0 bottom-0 z-30 mb-wood flex items-center gap-3 px-4 py-2.5 transition-transform duration-200 ${
          stickyVisible ? "translate-y-0" : "translate-y-full"
        } motion-reduce:transition-none`}
        style={{
          paddingBottom: "calc(10px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <span className="flex-1 min-w-0 font-display text-[22px] leading-none whitespace-nowrap text-ivory tabular-nums">
          {formatChf(totalNum.toFixed(2))}
        </span>
        <button
          type="button"
          tabIndex={stickyVisible ? 0 : -1}
          onClick={handleAdd}
          disabled={!canBuy}
          className="h-12 px-5 bg-rose text-ivory text-[16px] font-semibold whitespace-nowrap hover:brightness-110 transition-[filter] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {feedback === "added" ? "✓ Hinzugefügt" : "In den Warenkorb"}
        </button>
      </div>

      {/* ---- Trust line ---- */}
      <p className="mt-[18px] flex flex-wrap justify-center items-center gap-x-3.5 gap-y-1.5 text-[13px] text-sage">
        <span>Eigener Van, kein Kurier</span>
        <span aria-hidden>·</span>
        <span>Auch am Sonntag</span>
        <span aria-hidden>·</span>
        <span>Gratis-Lieferung ab CHF 120</span>
        <span aria-hidden>·</span>
        <span>TWINT &amp; Karte</span>
      </p>
    </div>
  );
}
