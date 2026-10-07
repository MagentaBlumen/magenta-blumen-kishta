"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * Phone-first search in the admin header. Submits to /admin/suche?q=…
 * via a plain router push - no server action needed. Pre-fills from
 * the current URL so Sandra sees her query on the results page.
 */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;
    router.push(`/admin/suche?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={submit} className="relative">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Telefon, Nummer, Name …"
        aria-label="Bestellung suchen"
        inputMode="search"
        enterKeyHint="search"
        className="w-full sm:w-64 h-9 pl-3 pr-9 border border-input bg-background text-sm rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <button
        type="submit"
        aria-label="Suchen"
        className="absolute right-1.5 top-1.5 bottom-1.5 px-2 text-muted-foreground hover:text-foreground"
      >
        {/* magnifier */}
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
