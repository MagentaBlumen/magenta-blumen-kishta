"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { thumbUrl } from "@/lib/image-urls";
import { formatChf, formatChfFrom, minPrice } from "@/lib/money";
import { archiveProductsAction } from "../actions";

/**
 * Produkte grid. Server loads rows + first image + variant prices;
 * this component owns the selection + bulk-archive UX.
 *
 * Design intent (parallel to the storefront product card):
 *   - 3:4 image on top, pricing + status below
 *   - checkbox top-left when visible on hover (always visible on
 *     touch) toggles selection
 *   - whole card is a link to the edit page EXCEPT the checkbox
 *     stopPropagation'd
 *   - "N ausgewählt" bar sticks to the top of the viewport when any
 *     row is selected, with Archivieren / Wiederherstellen / Abbrechen
 */

type Row = {
  id: number;
  slug: string;
  nameDe: string;
  pricingMode: "variant" | "per_unit" | "enquiry";
  isAvailable: boolean;
  isOnlineOrderable: boolean;
  isArchived: boolean;
  sortOrder: number;
  imageUrl: string | null;
  imageAlt: string | null;
  prices: string[];
  variantCount: number;
};

type Filter = "alle" | "aktiv" | "archiviert" | "ausverkauft";

export function ProdukteList({
  rows,
  filter,
  counts,
}: {
  rows: Row[];
  filter: Filter;
  counts: { all: number; aktiv: number; archiviert: number; ausverkauft: number };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // When filter changes server-side, selection may contain rows no
  // longer visible. Prune to prevent "ghost" bulk ops on hidden rows.
  const visibleIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const effectiveSelected = useMemo(() => {
    const next = new Set<number>();
    for (const id of selected) if (visibleIds.has(id)) next.add(id);
    return next;
  }, [selected, visibleIds]);

  // Dominant mode of selection — if ALL selected rows are already
  // archived, offer "Wiederherstellen"; otherwise "Archivieren". The
  // mixed case falls back to Archivieren (safer no-op for already-
  // archived rows).
  const selectedRows = rows.filter((r) => effectiveSelected.has(r.id));
  const allSelectedArchived =
    selectedRows.length > 0 && selectedRows.every((r) => r.isArchived);
  const mode: "archive" | "unarchive" = allSelectedArchived
    ? "unarchive"
    : "archive";

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (effectiveSelected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  }

  function clear() {
    setSelected(new Set());
  }

  function runBulk() {
    const ids = Array.from(effectiveSelected);
    if (ids.length === 0) return;
    const archive = mode === "archive";
    const confirmLabel =
      archive
        ? `${ids.length} ${ids.length === 1 ? "Produkt" : "Produkte"} archivieren?\n\n` +
          "Archivierte Produkte verschwinden aus dem Shop, bleiben aber in alten Bestellungen erhalten."
        : `${ids.length} ${ids.length === 1 ? "Produkt" : "Produkte"} wiederherstellen?`;
    if (!window.confirm(confirmLabel)) return;

    setError(null);
    startTransition(async () => {
      try {
        await archiveProductsAction(ids, archive);
        setSelected(new Set());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-light text-[clamp(1.8rem,3vw,2.4rem)] leading-tight">
            Produkte
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {counts.all === 0
              ? "Noch keine Produkte."
              : `${counts.all} ${counts.all === 1 ? "Produkt" : "Produkte"} insgesamt`}
          </p>
        </div>
        <Link
          href="/admin/produkte/neu"
          className="group inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 text-xs tracking-[0.14em] uppercase font-medium hover:bg-rose active:translate-y-px transition-all duration-200"
        >
          Neues Produkt
          <span className="transition-transform duration-200 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip href="/admin/produkte" label="Alle" count={counts.all} active={filter === "alle"} />
        <FilterChip
          href="/admin/produkte?filter=aktiv"
          label="Aktiv"
          count={counts.aktiv}
          active={filter === "aktiv"}
        />
        <FilterChip
          href="/admin/produkte?filter=ausverkauft"
          label="Ausverkauft"
          count={counts.ausverkauft}
          active={filter === "ausverkauft"}
        />
        <FilterChip
          href="/admin/produkte?filter=archiviert"
          label="Archiviert"
          count={counts.archiviert}
          active={filter === "archiviert"}
        />
      </div>

      {/* Bulk-select bar - only when something is selected */}
      {effectiveSelected.size > 0 && (
        <div className="sticky top-14 z-20 flex items-center justify-between gap-3 bg-card border border-foreground/15 rounded-md px-4 py-2.5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium tabular-nums">
              {effectiveSelected.size} ausgewählt
            </span>
            <button
              type="button"
              onClick={clear}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Abbrechen
            </button>
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs text-rose-600 max-w-[200px]">{error}</span>
            )}
            <button
              type="button"
              onClick={toggleAll}
              className="text-xs px-3 py-1.5 border border-input hover:bg-muted rounded"
            >
              {effectiveSelected.size === rows.length
                ? "Keine auswählen"
                : "Alle auswählen"}
            </button>
            <button
              type="button"
              onClick={runBulk}
              disabled={isPending}
              className="inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-foreground text-background hover:bg-rose rounded font-medium disabled:opacity-50"
            >
              {isPending
                ? "…"
                : mode === "archive"
                  ? "Archivieren"
                  : "Wiederherstellen"}
            </button>
          </div>
        </div>
      )}

      {/* Grid */}
      {rows.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {rows.map((r) => (
            <li key={r.id}>
              <ProductCard
                row={r}
                selected={effectiveSelected.has(r.id)}
                onToggle={() => toggle(r.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs tracking-[0.1em] uppercase font-medium border rounded-md transition-colors duration-150";
  const cls = active
    ? `${base} border-foreground bg-foreground text-background`
    : `${base} border-input bg-background text-muted-foreground hover:text-foreground hover:border-foreground/50`;
  return (
    <Link href={href} className={cls}>
      {label}
      <span className="tabular-nums font-normal opacity-80">({count})</span>
    </Link>
  );
}

function ProductCard({
  row,
  selected,
  onToggle,
}: {
  row: Row;
  selected: boolean;
  onToggle: () => void;
}) {
  const price = renderPrice(row);
  const src = row.imageUrl ? thumbUrl(row.imageUrl) : null;

  return (
    <Link
      href={`/admin/produkte/${row.id}`}
      className={`group block rounded-md overflow-hidden border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-foreground/40 ${
        selected ? "border-rose ring-2 ring-rose/30" : "border-mist"
      } ${row.isArchived ? "opacity-70" : ""}`}
    >
      <div className="relative aspect-[4/5] bg-mist overflow-hidden">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={row.imageAlt ?? row.nameDe}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[0.7rem] text-sage uppercase tracking-wider">
            Kein Bild
          </div>
        )}

        {/* Checkbox: top-left, stop propagation so clicking it toggles
            without navigating. Always visible when selected; otherwise
            fades in on hover. Keyboard accessible via <label>. */}
        <label
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggle();
          }}
          className={`absolute top-2 left-2 flex items-center justify-center w-7 h-7 rounded border-2 bg-ivory/95 cursor-pointer transition-opacity duration-150 ${
            selected
              ? "border-rose opacity-100"
              : "border-foreground/40 opacity-0 group-hover:opacity-100"
          }`}
          aria-label={selected ? "Auswahl aufheben" : "Auswählen"}
        >
          <input
            type="checkbox"
            checked={selected}
            readOnly
            tabIndex={-1}
            className="sr-only"
          />
          {selected && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a0185a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </label>

        {/* Status pill: top-right */}
        <div className="absolute top-2 right-2">
          <StatusPill row={row} />
        </div>
      </div>

      <div className="p-3 space-y-1">
        <div className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-rose transition-colors duration-200">
          {row.nameDe}
        </div>
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="text-muted-foreground tabular-nums">{price}</span>
          <span className="text-muted-foreground/70 text-[0.68rem]">
            {row.variantCount > 0
              ? `${row.variantCount} ${row.variantCount === 1 ? "Variante" : "Varianten"}`
              : row.pricingMode === "enquiry"
                ? "Anfrage"
                : ""}
          </span>
        </div>
        <div className="text-[0.68rem] text-muted-foreground/60 font-mono truncate">
          {row.slug}
        </div>
      </div>
    </Link>
  );
}

function StatusPill({ row }: { row: Row }) {
  const base =
    "inline-block text-[0.6rem] tracking-[0.1em] uppercase font-medium px-2 py-0.5 border rounded shadow-sm bg-ivory/95";
  if (row.isArchived) {
    return (
      <span className={`${base} text-stone-600 border-stone-300`}>
        Archiviert
      </span>
    );
  }
  if (!row.isAvailable) {
    return (
      <span className={`${base} text-rose-700 border-rose-300`}>
        Ausverkauft
      </span>
    );
  }
  if (!row.isOnlineOrderable) {
    return (
      <span className={`${base} text-amber-700 border-amber-300`}>
        Nur Laden
      </span>
    );
  }
  return (
    <span className={`${base} text-emerald-700 border-emerald-300`}>
      Aktiv
    </span>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const headlines: Record<Filter, string> = {
    alle: "Noch keine Produkte",
    aktiv: "Keine aktiven Produkte",
    archiviert: "Nichts im Archiv",
    ausverkauft: "Nichts ausverkauft",
  };
  const sub: Record<Filter, string> = {
    alle: "Beginnen Sie mit dem Anlegen des ersten Produkts.",
    aktiv:
      "Alle vorhandenen Produkte sind entweder archiviert oder ausverkauft.",
    archiviert: "Noch keine archivierten Produkte - alles ist im Shop.",
    ausverkauft:
      "Alle aktiven Produkte sind verfügbar. Gute Nachrichten.",
  };
  return (
    <div className="rounded-lg border border-dashed p-12 text-center">
      <h2 className="font-display font-light text-xl">{headlines[filter]}</h2>
      <p className="text-sm text-muted-foreground mt-2 mb-5">
        {sub[filter]}
      </p>
      {filter === "alle" && (
        <Link
          href="/admin/produkte/neu"
          className="group inline-flex items-center gap-2 bg-foreground text-background px-5 py-2.5 text-xs tracking-[0.14em] uppercase font-medium hover:bg-rose transition-colors"
        >
          Erstes Produkt anlegen
          <span className="transition-transform duration-200 group-hover:translate-x-1">
            →
          </span>
        </Link>
      )}
    </div>
  );
}

function renderPrice(row: Row): string {
  if (row.pricingMode === "enquiry") return "Auf Anfrage";
  if (row.pricingMode === "per_unit") {
    const p = row.prices[0];
    return p ? `${formatChf(p)} / Stück` : "–";
  }
  if (row.prices.length === 0) return "–";
  const min = minPrice(row.prices);
  return row.prices.length > 1 ? formatChfFrom(min) : formatChf(min);
}
