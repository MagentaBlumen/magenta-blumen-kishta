"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Sticky header with mega-menu dropdowns.
 *
 * Interaction model:
 *   - Desktop hover with a ~200ms close-delay so the pointer can
 *     cross the gap between button and panel without flicker. Click
 *     also toggles for keyboard / touch users.
 *   - A full-viewport scrim behind the panel closes on click.
 *   - Escape closes and returns focus to the trigger.
 *   - Mobile keeps the native <details>-style accordion we had before.
 *
 * Three panel kinds — each mapped to a nav item:
 *   - `list`     — Blumen: 2-column category list with sub text
 *   - `tiles`    — Anlass: 6 coloured tiles
 *   - `swatches` — Nach Farbe: colour swatches with a title on the side
 */

type ListItem = { label: string; sub?: string; href: string };
type TileItem = {
  label: string;
  sub: string;
  href: string;
  bg: string;
  text: string;
  border?: string;
};
type SwatchItem = { label: string; hex?: string; border?: boolean; href: string };

type NavItem =
  | {
      kind: "list";
      id: string;
      label: string;
      eyebrow: string;
      items: ListItem[];
      allHref: string;
      allLabel: string;
    }
  | {
      kind: "tiles";
      id: string;
      label: string;
      eyebrow: string;
      items: TileItem[];
      allHref: string;
      allLabel: string;
    }
  | {
      kind: "swatches";
      id: string;
      label: string;
      eyebrow: string;
      titleMain: string;
      titleItalic: string;
      items: SwatchItem[];
      allHref: string;
      allLabel: string;
    };

const NAV: NavItem[] = [
  {
    kind: "list",
    id: "mega-blumen",
    label: "Blumen",
    eyebrow: "Blumen & Pflanzen",
    items: [
      { label: "Blumensträusse", sub: "Von Hand gebunden", href: "/kategorie/blumenstraeusse" },
      { label: "Rosen", sub: "Klassisch & romantisch", href: "/kategorie/rosen" },
      { label: "Schnittblumen", sub: "Frisch & saisonal", href: "/kategorie/schnittblumen" },
      { label: "Gestecke", sub: "In Schale & Topf", href: "/kategorie/gestecke" },
      { label: "Zimmerpflanzen", sub: "Grün, das bleibt", href: "/kategorie/zimmerpflanzen" },
      { label: "Orchideen", sub: "Elegant & langlebig", href: "/kategorie/orchideen" },
      { label: "Trockenblumen", sub: "Blühen für immer", href: "/kategorie/trockenblumen" },
    ],
    allHref: "/kategorie/blumenstraeusse",
    allLabel: "Alle Blumen ansehen",
  },
  {
    kind: "tiles",
    id: "mega-anlass",
    label: "Anlass",
    eyebrow: "Wofür sind die Blumen?",
    items: [
      { label: "Geburtstag", sub: "Fröhlich & bunt →", href: "/kategorie/geburtstag", bg: "#F3D9DF", text: "#2B1D1B" },
      { label: "Liebe & Romantik", sub: "Rosen & mehr →", href: "/kategorie/liebe", bg: "#A3165F", text: "#FFFFFF" },
      { label: "Danke", sub: "Eine kleine Geste →", href: "/kategorie/danke", bg: "#E9E0C8", text: "#2B1D1B" },
      { label: "Gute Besserung", sub: "Mit frischen Farben →", href: "/kategorie/gute-besserung", bg: "#EFE7DD", text: "#2B1D1B" },
      { label: "Trost & Trauer", sub: "Mit Ruhe gebunden →", href: "/kategorie/trauer", bg: "#3A2E2C", text: "#F4EDE4" },
      { label: "Alle Anlässe", sub: "Oder rufen Sie uns an", href: "/kategorie/alle-anlaesse", bg: "#FBF7F2", text: "#2B1D1B", border: "#CDBFB3" },
    ],
    allHref: "/kategorie/alle-anlaesse",
    allLabel: "Alle Anlässe ansehen",
  },
  {
    kind: "swatches",
    id: "mega-farbe",
    label: "Nach Farbe",
    eyebrow: "Nach Farbe",
    titleMain: "Welche Farbe",
    titleItalic: "soll es sein?",
    items: [
      { label: "Weiss-Crème", hex: "#F8F2E5", border: true, href: "/farbe/weiss-creme" },
      { label: "Rosa-Pink", hex: "#E8A3BE", href: "/farbe/rosa-pink" },
      { label: "Rot", hex: "#9E1B32", href: "/farbe/rot" },
      { label: "Orange-Lachs", hex: "#E8853B", href: "/farbe/orange-lachs" },
      { label: "Gelb", hex: "#F2C744", href: "/farbe/gelb" },
      { label: "Grün", hex: "#6E9A5B", href: "/farbe/gruen" },
      { label: "Violett-Blau", hex: "#6D52A8", href: "/farbe/violett-blau" },
      // No hex → conic gradient fallback for "Bunt".
      { label: "Bunt", href: "/farbe/bunt" },
    ],
    allHref: "/",
    allLabel: "Alle Farben ansehen",
  },
];

const HOVER_CLOSE_DELAY_MS = 200;

export function SiteHeader({
  initialCartCount = 0,
}: {
  initialCartCount?: number;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const cartCount = initialCartCount;

  function openPanel(id: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenId(id);
  }
  function closePanelSoon() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenId(null), HOVER_CLOSE_DELAY_MS);
  }
  function closePanelNow() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenId(null);
  }

  // Escape returns focus to the trigger that opened the panel.
  useEffect(() => {
    if (!openId) return;
    const activeId = openId;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        const ref = triggerRefs.current[activeId];
        closePanelNow();
        ref?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function closeMobile() {
    setMobileOpen(false);
    setMobileExpanded(null);
  }

  const currentItem = NAV.find((n) => n.id === openId) ?? null;

  return (
    <>
      <header
        className="sticky top-0 z-50"
        onMouseLeave={closePanelSoon}
        onMouseEnter={() => {
          if (closeTimer.current) clearTimeout(closeTimer.current);
        }}
      >
        <div className="relative bg-ivory border-b border-mist">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 lg:h-[76px] flex items-center justify-between gap-4 lg:gap-8">
            {/* Mobile burger */}
            <button
              type="button"
              aria-label={mobileOpen ? "Menü schliessen" : "Menü öffnen"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((o) => !o)}
              className="lg:hidden grid place-items-center w-11 h-11 text-bark hover:text-rose transition-colors"
            >
              {mobileOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>

            {/* Logo */}
            <Link href="/" aria-label="Magenta Blumen · Startseite" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/magenta-blumen-logo.png"
                alt="Magenta Blumen"
                className="h-10 lg:h-12 w-auto object-contain"
              />
            </Link>

            {/* Desktop nav */}
            <nav aria-label="Hauptnavigation" className="hidden lg:flex items-stretch h-full gap-1">
              {NAV.map((item) => {
                const isOpen = openId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    ref={(el) => {
                      triggerRefs.current[item.id] = el;
                    }}
                    aria-expanded={isOpen}
                    aria-controls={item.id}
                    onClick={() => (isOpen ? closePanelNow() : openPanel(item.id))}
                    onMouseEnter={() => openPanel(item.id)}
                    className={`h-full px-4 -mb-px border-b-2 inline-flex items-center gap-2 text-[13px] tracking-[0.12em] uppercase font-semibold transition-colors ${
                      isOpen ? "border-rose text-rose" : "border-transparent text-bark hover:text-rose"
                    }`}
                  >
                    {item.label}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                      className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                );
              })}
            </nav>

            {/* Icons */}
            <div className="flex items-center gap-1">
              <Link
                href="/konto"
                aria-label="Mein Konto"
                className="w-11 h-11 grid place-items-center text-bark hover:text-rose transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
                </svg>
              </Link>
              <Link
                href="/warenkorb"
                aria-label={`Warenkorb${cartCount > 0 ? `, ${cartCount} Artikel` : ""}`}
                className="relative w-11 h-11 grid place-items-center text-bark hover:text-rose transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 8h14l-1.2 12H6.2L5 8z" />
                  <path d="M9 8V6a3 3 0 0 1 6 0v2" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute right-1 top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose text-ivory text-[11px] font-semibold grid place-items-center">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Mega panel — visibility toggled per item */}
          {currentItem && (
            <div
              id={currentItem.id}
              role="region"
              aria-label={currentItem.label}
              className="hidden lg:block absolute left-0 right-0 top-full z-10 bg-ivory border-b border-mist shadow-[0_40px_80px_-10px_rgba(43,29,27,0.35),0_16px_32px_-8px_rgba(43,29,27,0.22)] animate-in fade-in slide-in-from-top-1 duration-200"
            >
              <div className="max-w-7xl mx-auto px-8 py-9">
                {currentItem.kind === "list" && (
                  <ListPanel item={currentItem} onNavigate={closePanelNow} />
                )}
                {currentItem.kind === "tiles" && (
                  <TilesPanel item={currentItem} onNavigate={closePanelNow} />
                )}
                {currentItem.kind === "swatches" && (
                  <SwatchesPanel item={currentItem} onNavigate={closePanelNow} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden border-b border-mist bg-ivory max-h-[calc(100vh-4rem)] overflow-y-auto">
            <nav aria-label="Mobiles Menü" className="py-1">
              {NAV.map((item) => {
                const isExpanded = mobileExpanded === item.id;
                const links = flattenForMobile(item);
                return (
                  <div key={item.id} className="border-b border-mist last:border-b-0">
                    <button
                      type="button"
                      onClick={() =>
                        setMobileExpanded((prev) =>
                          prev === item.id ? null : item.id,
                        )
                      }
                      aria-expanded={isExpanded}
                      className="w-full flex items-center justify-between px-5 py-4 text-[13px] tracking-[0.12em] uppercase font-semibold text-bark hover:text-rose transition-colors"
                    >
                      <span>{item.label}</span>
                      <span
                        aria-hidden
                        className={`text-[1.1rem] leading-none transition-transform ${isExpanded ? "rotate-45" : ""}`}
                      >
                        +
                      </span>
                    </button>
                    {isExpanded && (
                      <ul className="pb-3 bg-cream">
                        {links.map((l) => (
                          <li key={l.href + l.label}>
                            <Link
                              href={l.href}
                              onClick={closeMobile}
                              className="block px-8 py-2.5 font-display text-[1.1rem] text-bark hover:text-rose transition-colors"
                            >
                              {l.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Scrim — behind the panel but above page content. Click closes. */}
      {openId && (
        <button
          type="button"
          aria-label="Menü schliessen"
          tabIndex={-1}
          onClick={closePanelNow}
          className="hidden lg:block fixed inset-0 z-40 bg-bark/40 cursor-default animate-in fade-in duration-200"
        />
      )}
    </>
  );
}

/* ================= Panel variants ================= */

function ListPanel({
  item,
  onNavigate,
}: {
  item: Extract<NavItem, { kind: "list" }>;
  onNavigate: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="m-0 text-[12px] font-semibold tracking-[0.14em] uppercase text-sage">
          {item.eyebrow}
        </p>
        <AllLink
          href={item.allHref}
          label={item.allLabel}
          onClick={onNavigate}
        />
      </div>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
        {item.items.map((cat) => (
          <li key={cat.href}>
            <Link
              href={cat.href}
              onClick={onNavigate}
              className="group flex items-center justify-between gap-3 py-3 px-3.5 -mx-3.5 rounded hover:bg-cream transition-colors"
            >
              <span className="flex flex-col gap-0.5">
                <span className="font-display text-[1.3rem] leading-[1.2] text-bark">
                  {cat.label}
                </span>
                {cat.sub && (
                  <span className="text-[13px] text-sage">{cat.sub}</span>
                )}
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
                className="text-rose opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TilesPanel({
  item,
  onNavigate,
}: {
  item: Extract<NavItem, { kind: "tiles" }>;
  onNavigate: () => void;
}) {
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p className="m-0 text-[12px] font-semibold tracking-[0.14em] uppercase text-sage">
          {item.eyebrow}
        </p>
        <AllLink
          href={item.allHref}
          label={item.allLabel}
          onClick={onNavigate}
        />
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {item.items.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              onClick={onNavigate}
              className="flex flex-col justify-between gap-6 min-h-[150px] p-5 rounded-md hover:-translate-y-0.5 transition-transform duration-200"
              style={{
                background: t.bg,
                color: t.text,
                border: t.border ? `1px dashed ${t.border}` : undefined,
              }}
            >
              <span className="font-display text-[1.35rem] leading-[1.15]">
                {t.label}
              </span>
              <span className="text-[13px] opacity-90">{t.sub}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SwatchesPanel({
  item,
  onNavigate,
}: {
  item: Extract<NavItem, { kind: "swatches" }>;
  onNavigate: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-8 gap-x-12 py-2">
      <div className="max-w-[320px]">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="m-0 text-[12px] font-semibold tracking-[0.14em] uppercase text-sage">
            {item.eyebrow}
          </p>
        </div>
        <p className="m-0 font-display font-light text-bark text-[clamp(1.6rem,2vw,1.8rem)] leading-[1.2]">
          {item.titleMain}{" "}
          <em className="italic">{item.titleItalic}</em>
        </p>
        <div className="mt-3">
          <AllLink
            href={item.allHref}
            label={item.allLabel}
            onClick={onNavigate}
          />
        </div>
      </div>
      <nav aria-label="Nach Farbe" className="flex flex-wrap gap-x-9 gap-y-6">
        {item.items.map((c) => {
          const background =
            c.hex ??
            "conic-gradient(from 0deg, #F2BFCB 0 25%, #F1C84B 0 50%, #8A5BA8 0 75%, #9E1B32 0)";
          return (
            <Link
              key={c.href}
              href={c.href}
              onClick={onNavigate}
              className="flex flex-col items-center gap-2.5 text-[14px] font-medium text-bark hover:text-rose transition-colors"
            >
              <span
                aria-hidden
                className="block w-[72px] h-[72px] rounded-full transition-transform duration-200 hover:scale-105"
                style={{
                  background,
                  border: c.border ? "1px solid #DCCFC2" : undefined,
                }}
              />
              {c.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function AllLink({
  href,
  label,
  onClick,
}: {
  href: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-rose hover:underline"
    >
      {label}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
        className="transition-transform duration-200 group-hover:translate-x-0.5"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

function flattenForMobile(item: NavItem): { label: string; href: string }[] {
  return item.items.map((i) => ({ label: i.label, href: i.href }));
}
