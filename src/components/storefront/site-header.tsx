"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Sticky header. Layout borrowed from the Figma:
 *   Logo (left)  ·  4 nav dropdowns (center)  ·  cart icon (right)
 *
 * Deliberate omissions vs Figma per project_phase1_scope_lock:
 *   - No search icon (search overlay is out of scope for MVP)
 *   - No wishlist heart (wishlist feature is out of scope)
 *   - No account icon yet (customer accounts are optional post-payment;
 *     no meaningful place for it in the header pre-checkout)
 *   - Cart icon shows the count but the drawer wiring is in Session 5.
 *     For now the click routes to /warenkorb which will land in 4d/5.
 *
 * Nav items map to REAL categories in our DB, not Figma's mock labels
 * ("Ecuador-Rosen", etc.). "Nach Farbe" points to placeholder for now -
 * proper colour-filtered browse comes in chunk 4e / 4f.
 */

type NavItem = {
  label: string;
  items: { label: string; href: string }[];
};

const NAV: NavItem[] = [
  {
    label: "Blumen",
    items: [
      { label: "Blumensträusse", href: "/kategorie/blumenstraeusse" },
      { label: "Rosen", href: "/kategorie/rosen" },
      { label: "Schnittblumen", href: "/kategorie/schnittblumen" },
      { label: "Gestecke", href: "/kategorie/gestecke" },
      { label: "Zimmerpflanzen", href: "/kategorie/zimmerpflanzen" },
      { label: "Orchideen", href: "/kategorie/orchideen" },
      { label: "Trockenblumen", href: "/kategorie/trockenblumen" },
    ],
  },
  {
    label: "Anlass",
    items: [
      { label: "Geburtstag", href: "/kategorie/geburtstag" },
      { label: "Liebe & Romantik", href: "/kategorie/liebe" },
      { label: "Danke", href: "/kategorie/danke" },
      { label: "Gute Besserung", href: "/kategorie/gute-besserung" },
      { label: "Geburt", href: "/kategorie/geburt" },
      { label: "Trost & Trauer", href: "/kategorie/trauer" },
      { label: "Alle Anlässe", href: "/kategorie/alle-anlaesse" },
    ],
  },
  {
    label: "Nach Farbe",
    items: [
      // TODO(chunk-4f): dedicated /farbe/[slug] route. For now points at
      // the "all occasions" catch-all until we wire colour filtering.
      { label: "Weiss-Crème", href: "/kategorie/alle-anlaesse" },
      { label: "Rosa-Pink", href: "/kategorie/alle-anlaesse" },
      { label: "Rot", href: "/kategorie/alle-anlaesse" },
      { label: "Orange-Lachs", href: "/kategorie/alle-anlaesse" },
      { label: "Gelb", href: "/kategorie/alle-anlaesse" },
      { label: "Grün", href: "/kategorie/alle-anlaesse" },
      { label: "Violett-Blau", href: "/kategorie/alle-anlaesse" },
      { label: "Bunt", href: "/kategorie/alle-anlaesse" },
    ],
  },
];

export function SiteHeader() {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const cartCount = 0; // wired up in Session 5

  return (
    <header className="sticky top-0 z-50 border-b border-mist bg-ivory">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="font-display text-[1.6rem] font-normal tracking-tight text-bark leading-none">
          Magenta Blumen
        </Link>

        {/* Nav */}
        <nav className="hidden lg:flex items-center gap-9">
          {NAV.map((item) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => setOpenLabel(item.label)}
              onMouseLeave={() => setOpenLabel(null)}
            >
              <button
                type="button"
                className={`text-[0.72rem] tracking-[0.14em] uppercase font-medium transition-colors ${
                  openLabel === item.label
                    ? "text-rose"
                    : "text-bark hover:text-rose"
                }`}
              >
                {item.label}
              </button>
              {openLabel === item.label && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 min-w-[190px] bg-ivory border border-mist py-2 shadow-sm">
                  {item.items.map((sub) => (
                    <Link
                      key={sub.href + sub.label}
                      href={sub.href}
                      className="block px-5 py-2 text-[0.78rem] text-bark hover:bg-cream hover:text-rose transition-colors"
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        {/* Icons */}
        <div className="flex items-center gap-5">
          <Link
            href="/warenkorb"
            className="relative text-bark hover:text-rose transition-colors"
            aria-label="Warenkorb"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" x2="21" y1="6" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose text-ivory rounded-full h-4 w-4 text-[10px] leading-none flex items-center justify-center font-semibold">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
