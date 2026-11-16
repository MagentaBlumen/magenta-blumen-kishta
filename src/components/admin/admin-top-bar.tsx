"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

// Mobile-only sticky top bar: shows the current page title and a
// magnifier button that reveals the search form below. Hidden on
// desktop via CSS (.adm-top { display: none } with a 900px override).
export function AdminTopBar() {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);

  const title = titleFor(pathname);

  return (
    <>
      <header className="adm-top">
        <span className="adm-top__title" aria-hidden>
          {title}
        </span>
        <button
          type="button"
          className="adm-top__btn"
          aria-label="Suchen"
          aria-expanded={searchOpen}
          aria-controls="adm-top-search"
          onClick={() => setSearchOpen((v) => !v)}
        >
          <svg
            className="icon"
            width="22"
            height="22"
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
        </button>
      </header>
      <form
        className="adm-top__search"
        id="adm-top-search"
        role="search"
        action="/admin/suche"
        method="get"
        hidden={!searchOpen}
      >
        <div className="adm-search">
          <label htmlFor="adm-search-m" className="sr-only">
            Suchen
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
            id="adm-search-m"
            name="q"
            type="search"
            placeholder="Bestellung oder Kunde suchen"
            autoComplete="off"
            autoFocus
          />
        </div>
      </form>
    </>
  );
}

function titleFor(pathname: string): string {
  if (pathname.startsWith("/admin/produkte")) return "Produkte";
  if (pathname.startsWith("/admin/kunden")) return "Kunden";
  if (pathname.startsWith("/admin/einstellungen")) return "Einstellungen";
  if (pathname.startsWith("/admin/kalender")) return "Kalender";
  if (pathname.startsWith("/admin/bestellung")) return "Bestellung";
  if (pathname.startsWith("/admin/suche")) return "Suche";
  return "Bestellungen";
}
