"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductCard, type ProductCardData } from "./product-card";
import { minPrice } from "@/lib/money";

type SortMode = "default" | "asc" | "desc";

/**
 * Client-side sort + grid for a category browse page. Receives cards
 * pre-sorted by `sortOrder` (which the "Empfohlen" option restores).
 *
 * Also renders the pinned "Wunschstrauss" tile as the last card in
 * the grid, regardless of sort — it's a CTA, not a product.
 */
export function CategoryBrowser({ cards }: { cards: ProductCardData[] }) {
  const [sort, setSort] = useState<SortMode>("default");

  const sorted = useMemo(() => {
    if (sort === "default") return cards;
    const copy = cards.slice();
    copy.sort((a, b) => {
      const pa = cheapestPrice(a);
      const pb = cheapestPrice(b);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1;
      if (pb === null) return -1;
      return sort === "asc" ? pa - pb : pb - pa;
    });
    return copy;
  }, [cards, sort]);

  return (
    <div className="flex flex-col gap-10">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-t border-b border-mist">
        <p className="m-0 text-[14px] text-bark/70">
          <strong className="font-semibold text-bark">{cards.length}</strong>{" "}
          {cards.length === 1 ? "Produkt" : "Produkte"}
        </p>
        <div
          role="group"
          aria-label="Sortieren"
          className="flex flex-wrap items-center gap-1"
        >
          <span className="text-[14px] text-bark/70 mr-2">Sortieren:</span>
          <SortButton
            label="Empfohlen"
            active={sort === "default"}
            onClick={() => setSort("default")}
          />
          <SortButton
            label="Preis aufsteigend"
            active={sort === "asc"}
            onClick={() => setSort("asc")}
          />
          <SortButton
            label="Preis absteigend"
            active={sort === "desc"}
            onClick={() => setSort("desc")}
          />
        </div>
      </div>

      {/* Grid */}
      <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 list-none m-0 p-0">
        {sorted.map((p) => (
          <li key={p.slug}>
            <ProductCard product={p} />
          </li>
        ))}
        <li>
          <WunschTile />
        </li>
      </ul>
    </div>
  );
}

function cheapestPrice(p: ProductCardData): number | null {
  if (p.pricingMode === "enquiry") return null;
  const m = minPrice(p.variantPrices);
  if (!m) return null;
  const n = Number(m);
  return Number.isFinite(n) ? n : null;
}

function SortButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 px-3.5 rounded text-[14px] font-medium transition-colors ${
        active
          ? "bg-cream text-bark font-semibold"
          : "text-bark/70 hover:text-bark"
      }`}
    >
      {label}
    </button>
  );
}

function WunschTile() {
  return (
    <div className="flex flex-col justify-between gap-6 p-7 rounded bg-rose text-ivory h-full min-h-[360px]">
      <div className="flex flex-col gap-3.5">
        <span className="text-[12px] font-semibold tracking-[0.12em] uppercase opacity-85">
          Nach Wunsch
        </span>
        <span className="font-display text-[1.8rem] leading-[1.15] font-light">
          Nichts Passendes <em className="italic">dabei?</em>
        </span>
        <span className="text-[15px] leading-[1.6] opacity-95">
          Sagen Sie uns Anlass, Farben und Budget — wir binden Ihren Strauss
          von Hand.
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        <Link
          href="tel:+41565565609"
          className="inline-flex items-center justify-center h-12 rounded bg-ivory text-bark font-semibold text-[15px] hover:text-rose transition-colors"
        >
          Wunschstrauss anfragen
        </Link>
        <a
          href="tel:+41565565609"
          className="text-center text-[14px] text-ivory/95 underline hover:opacity-80"
        >
          oder anrufen: 056 556 56 09
        </a>
      </div>
    </div>
  );
}
