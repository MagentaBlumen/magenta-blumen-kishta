"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toggleProductAvailabilityAction } from "@/app/(admin)/admin/produkte/actions";
import { formatChf, formatChfFrom } from "@/lib/money";
import { thumbUrl } from "@/lib/image-urls";

export type ProduktRow = {
  id: number;
  slug: string;
  nameDe: string;
  pricingMode: "variant" | "per_unit" | "enquiry";
  isAvailable: boolean;
  isOnlineOrderable: boolean;
  isArchived: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  prices: string[];
};

export type Counts = {
  all: number;
  sold: number;
  archived: number;
};

type TabKey = "all" | "sold" | "archived";

export function ProdukteGrid({
  rows,
  counts,
  tab,
}: {
  rows: ProduktRow[];
  counts: Counts;
  tab: TabKey;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState("");

  const visible = useMemo(() => {
    if (!q) return rows;
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => r.nameDe.toLowerCase().includes(needle));
  }, [rows, q]);

  function switchTab(next: TabKey) {
    const params = new URLSearchParams(sp.toString());
    if (next === "all") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.push(qs ? `/admin/produkte?${qs}` : "/admin/produkte");
  }

  const emptyCopy = q
    ? "Kein Produkt gefunden."
    : tab === "archived"
      ? "Keine Produkte im Archiv."
      : tab === "sold"
        ? "Nichts ausverkauft."
        : "Noch keine Produkte.";

  return (
    <>
      <div className="toolbar">
        <div className="field-search">
          <label htmlFor="prod-search" className="sr-only">
            Produkt suchen
          </label>
          <svg
            className="icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            id="prod-search"
            type="search"
            placeholder="Produkt suchen"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="seg" role="group" aria-label="Anzeigen">
          <button
            type="button"
            aria-pressed={tab === "all"}
            onClick={() => switchTab("all")}
          >
            Im Shop <span>{counts.all}</span>
          </button>
          <button
            type="button"
            aria-pressed={tab === "sold"}
            onClick={() => switchTab("sold")}
          >
            Ausverkauft <span>{counts.sold}</span>
          </button>
          <button
            type="button"
            aria-pressed={tab === "archived"}
            onClick={() => switchTab("archived")}
          >
            Archiv <span>{counts.archived}</span>
          </button>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="empty">{emptyCopy}</p>
      ) : (
        <ul className="pgrid">
          {visible.map((p) => (
            <li key={p.id}>
              <ProduktCard product={p} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ProduktCard({ product: p }: { product: ProduktRow }) {
  const isSold = !p.isAvailable && !p.isArchived;
  const priceLabel = priceLabelFor(p);
  const editHref = `/admin/produkte/${p.id}`;

  return (
    <article
      className={`p ${isSold ? "is-sold" : ""}`}
      data-id={p.id}
    >
      <Link
        className="p__img"
        href={editHref}
        tabIndex={-1}
        aria-hidden
      >
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl(p.imageUrl)}
            alt={p.imageAlt ?? p.nameDe}
            loading="lazy"
          />
        ) : (
          <div style={{ width: "100%", aspectRatio: "4 / 3" }} />
        )}
        {isSold && <span className="p__flag">Ausverkauft</span>}
      </Link>
      <div className="p__body">
        <Link className="p__name" href={editHref}>
          {p.nameDe}
        </Link>
        <span className="p__price">{priceLabel}</span>
      </div>
      <div className="p__foot">
        {p.isArchived ? (
          <span className="p__price">Im Archiv</span>
        ) : (
          <SoldCheckbox id={p.id} isAvailable={p.isAvailable} />
        )}
        <Link
          className="p__edit"
          href={editHref}
          aria-label={`${p.nameDe} bearbeiten`}
        >
          <svg
            className="icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M4 20h4L20 8l-4-4L4 16z" />
            <path d="M13.5 6.5l4 4" />
          </svg>
          <span>Bearbeiten</span>
        </Link>
      </div>
    </article>
  );
}

function SoldCheckbox({
  id,
  isAvailable,
}: {
  id: number;
  isAvailable: boolean;
}) {
  const [checked, setChecked] = useState(!isAvailable);
  const [isPending, startTransition] = useTransition();

  function flip(nextChecked: boolean) {
    setChecked(nextChecked);
    startTransition(async () => {
      try {
        await toggleProductAvailabilityAction(id, !nextChecked);
      } catch (err) {
        console.error("toggle availability failed:", err);
        setChecked(!nextChecked);
      }
    });
  }

  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        disabled={isPending}
        onChange={(e) => flip(e.target.checked)}
      />
      Ausverkauft
    </label>
  );
}

function priceLabelFor(p: ProduktRow): string {
  if (p.pricingMode === "enquiry") return "Preis auf Anfrage";
  if (p.prices.length === 0) return "–";
  const nums = p.prices.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return "–";
  if (p.pricingMode === "per_unit") {
    return `${formatChf(p.prices[0])} pro Stück`;
  }
  if (nums.length === 1) return formatChf(p.prices[0]);
  const min = Math.min(...nums).toFixed(2);
  return formatChfFrom(min);
}
