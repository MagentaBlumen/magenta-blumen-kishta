"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Phone-first search in the admin header.
 *
 * Plain GET form submitting to /admin/suche?q=…  — no onSubmit handler,
 * no router.push, no preventDefault. If JS fails, the native form
 * submission still works. Keeps a controlled input only so the URL's
 * ?q=… pre-populates on the results page.
 */
export function SearchBox() {
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  return (
    <form action="/admin/suche" method="get" className="relative">
      <input
        name="q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Telefon, Nummer, Name …"
        aria-label="Bestellung suchen"
        inputMode="search"
        enterKeyHint="search"
        className="w-full sm:w-56 lg:w-64 h-9 pl-3 pr-9 border border-input bg-background text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose transition-colors"
      />
      <button
        type="submit"
        aria-label="Suchen"
        className="absolute right-1.5 top-1.5 bottom-1.5 px-2 text-muted-foreground hover:text-rose transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </button>
    </form>
  );
}
