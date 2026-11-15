"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

export type KundeListItem = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  orderCount: number;
  anonymised: boolean;
};

// Searchable customer list for the Kunden split pane. Server already
// filtered by the current ?q=, so the client search here is a quick
// narrow-within-results — a fuller search needs form submission.
export function KundenList({
  customers,
  selectedId,
  initialQuery,
}: {
  customers: KundeListItem[];
  selectedId: number | null;
  initialQuery: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(initialQuery);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((c) =>
      (c.name + " " + c.email + " " + (c.phone ?? "")).toLowerCase().includes(needle),
    );
  }, [customers, q]);

  function select(id: number) {
    const params = new URLSearchParams(sp.toString());
    params.set("selected", String(id));
    params.delete("dsg");
    router.push(`/admin/kunden?${params.toString()}`, { scroll: false });
  }

  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Push server-side query into the URL to re-run fetchCustomerList.
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    router.push(params.toString() ? `/admin/kunden?${params}` : "/admin/kunden");
  }

  return (
    <div className="clist-wrap">
      <form className="row" onSubmit={submitSearch} role="search">
        <div className="field-search field-search--narrow">
          <label htmlFor="cust-search" className="sr-only">
            Kunde suchen
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
            id="cust-search"
            type="search"
            placeholder="Name, E-Mail oder Telefon"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
        </div>
      </form>

      {visible.length === 0 ? (
        <p
          className="empty"
          style={{ padding: "24px", textAlign: "left" }}
        >
          Kein Kunde gefunden.
        </p>
      ) : (
        <ul className="clist">
          {visible.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="citem"
                aria-pressed={selectedId === c.id}
                onClick={() => select(c.id)}
                style={c.anonymised ? { opacity: 0.6 } : undefined}
              >
                <span className="citem__text">
                  <span className="citem__name">
                    {c.anonymised ? "Gelöschter Kunde" : c.name}
                  </span>
                  <span className="citem__mail">
                    {c.anonymised ? "–" : c.email}
                  </span>
                </span>
                <span className="citem__count">
                  {c.orderCount === 0
                    ? "Keine Bestellung"
                    : `${c.orderCount} ${c.orderCount === 1 ? "Bestellung" : "Bestellungen"}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
