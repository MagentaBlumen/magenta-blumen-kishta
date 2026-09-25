"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Sticky header. Layout borrowed from the Figma:
 *   Logo (left)  .  3 nav dropdowns (center)  .  cart icon (right)
 *
 * Deliberate omissions vs Figma per project_phase1_scope_lock:
 *   - No search icon (search overlay is out of scope for MVP)
 *   - No wishlist heart (wishlist feature is out of scope)
 *   - No account icon yet (customer accounts are optional post-payment;
 *     no meaningful place for it in the header pre-checkout)
 *   - Cart icon shows the count but the drawer wiring is in Session 5.
 *     For now the click routes to /warenkorb which lands in Session 5.
 *
 * Dropdowns toggle on CLICK, not hover. Touch users can't hover; hover
 * also flickers when the pointer crosses the gap between button and
 * panel. Click keeps behaviour identical across mouse + touch.
 *
 * Nav items map to REAL slugs in our DB (see drizzle/seed/01-base.sql).
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
    // Slugs from attribute_value.value where attribute.key='colour'.
    // /farbe/[slug] route lives in src/app/(storefront)/farbe/[slug]/.
    items: [
      { label: "Weiss-Crème", href: "/farbe/weiss-creme" },
      { label: "Rosa-Pink", href: "/farbe/rosa-pink" },
      { label: "Rot", href: "/farbe/rot" },
      { label: "Orange-Lachs", href: "/farbe/orange-lachs" },
      { label: "Gelb", href: "/farbe/gelb" },
      { label: "Grün", href: "/farbe/gruen" },
      { label: "Violett-Blau", href: "/farbe/violett-blau" },
      { label: "Pastell", href: "/farbe/pastell" },
      { label: "Bunt", href: "/farbe/bunt" },
    ],
  },
];

export function SiteHeader({
  initialCartCount = 0,
}: {
  initialCartCount?: number;
}) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  // Server passes down the count from the cookie on each render.
  // After add/remove actions, revalidatePath("/", "layout") re-runs
  // the layout, which recomputes this prop.
  const cartCount = initialCartCount;

  // Close dropdown on outside click or Escape.
  useEffect(() => {
    if (!openLabel) return;
    function onDown(e: MouseEvent) {
      if (!navRef.current) return;
      if (!navRef.current.contains(e.target as Node)) setOpenLabel(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenLabel(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openLabel]);

  return (
    <header className="sticky top-0 z-50 border-b border-mist bg-ivory">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" aria-label="Magenta Blumen . Startseite" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/magenta-blumen-logo.png"
            alt="Magenta Blumen"
            className="h-11 lg:h-12 w-auto object-contain"
          />
        </Link>

        {/* Nav */}
        <nav ref={navRef} className="hidden lg:flex items-center gap-9">
          {NAV.map((item) => {
            const isOpen = openLabel === item.label;
            return (
              <div key={item.label} className="relative">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-haspopup="menu"
                  onClick={() =>
                    setOpenLabel((prev) => (prev === item.label ? null : item.label))
                  }
                  className={`text-[0.72rem] tracking-[0.14em] uppercase font-medium transition-colors ${
                    isOpen ? "text-rose" : "text-bark hover:text-rose"
                  }`}
                >
                  {item.label}
                </button>
                {isOpen && (
                  <div
                    role="menu"
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-3 min-w-[200px] bg-ivory border border-mist py-2 shadow-sm"
                  >
                    {item.items.map((sub) => (
                      <Link
                        key={sub.href + sub.label}
                        href={sub.href}
                        role="menuitem"
                        onClick={() => setOpenLabel(null)}
                        className="block px-5 py-2 text-[0.78rem] text-bark hover:bg-cream hover:text-rose transition-colors"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Icons */}
        <div className="flex items-center gap-5">
          <Link
            href="/warenkorb"
            className="relative text-bark hover:text-rose transition-colors"
            aria-label="Warenkorb"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
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
