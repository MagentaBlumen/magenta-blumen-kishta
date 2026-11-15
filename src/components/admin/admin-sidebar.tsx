import Link from "next/link";
import { signOut } from "@/auth";
import { AdminNav } from "./admin-nav";

export function AdminSidebar({
  openOrderCount,
}: {
  openOrderCount: number;
}) {
  return (
    <nav className="adm-side" aria-label="Verwaltung">
      <div className="adm-side__inner">
        <span className="adm-brand">Magenta Blumen</span>

        <form className="adm-search" role="search" action="/admin/suche" method="get">
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

        <div className="adm-side__foot">
          <Link
            className="adm-shop"
            href="/"
            target="_blank"
            rel="noopener"
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
            <button type="submit" className="adm-logout">
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
                <path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H9" />
              </svg>
              Abmelden
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
