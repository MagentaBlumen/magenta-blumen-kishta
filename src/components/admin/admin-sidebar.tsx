import Link from "next/link";
import { signOut } from "@/auth";
import { AdminNav } from "./admin-nav";

// Desktop sidebar on the left (nav + search + logout). On phones this
// whole element becomes the bottom tab bar via CSS — only the tab list
// stays visible; brand/search/foot are display:none.
export function AdminSidebar({
  openOrderCount,
}: {
  openOrderCount: number;
}) {
  return (
    <nav className="adm-nav" aria-label="Verwaltung">
      <div className="adm-brand">
        <b>Magenta Blumen</b>
        <span>Verwaltung</span>
      </div>

      <form
        className="adm-search"
        role="search"
        action="/admin/suche"
        method="get"
      >
        <label htmlFor="adm-search" className="sr-only">
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
          id="adm-search"
          name="q"
          type="search"
          placeholder="Suchen"
          autoComplete="off"
        />
      </form>

      <AdminNav openOrderCount={openOrderCount} />

      <div className="adm-nav__foot">
        <Link href="/" target="_blank" rel="noopener">
          <svg
            className="icon"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
          </svg>
          Shop ansehen
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button type="submit">
            <svg
              className="icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H9" />
            </svg>
            Abmelden
          </button>
        </form>
      </div>
    </nav>
  );
}
