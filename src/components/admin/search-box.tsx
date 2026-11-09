/**
 * Admin header search. Plain server-rendered GET form posting to
 * /admin/suche?q=…
 *
 * Deliberately NOT a client component — nothing here needs React state.
 * No useSearchParams, no useRouter, no JS whatsoever. The browser's
 * native form submission is the ONLY code path. Keyboard + mouse both
 * work out of the box; hitting Enter submits; clicking the button
 * submits; nothing can swallow the event.
 *
 * On the results page, the Suche page itself echoes `q` back via its
 * own markup so the user sees what they typed.
 */
export function SearchBox() {
  return (
    <form action="/admin/suche" method="get" className="relative">
      <input
        name="q"
        type="search"
        placeholder="Telefon, Nummer, Name …"
        aria-label="Bestellung suchen"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
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
