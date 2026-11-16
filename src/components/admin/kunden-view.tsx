"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { anonymiseCustomerFromKundenAction } from "@/app/(admin)/admin/kunden/actions";
import { formatChf } from "@/lib/money";
import type { OrderStatus } from "@/lib/admin/order-status";

export type KundeListItem = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  orderCount: number;
  anonymised: boolean;
};

export type KundeOrder = {
  id: number;
  orderNumber: string;
  placedAt: string; // pre-formatted "Mo, 16. Nov"
  what: string;
  price: string;
  status: OrderStatus;
};

export type KundeDetailData = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  since: string; // pre-formatted "Oktober 2026"
  orders: KundeOrder[];
};

const UI_LABEL: Record<"neu" | "fertig" | "unterwegs" | "geliefert", string> = {
  neu: "Neu",
  fertig: "Fertig",
  unterwegs: "Unterwegs",
  geliefert: "Geliefert",
};

function uiStageFor(
  s: OrderStatus,
): "neu" | "fertig" | "unterwegs" | "geliefert" {
  switch (s) {
    case "new":
    case "confirmed":
      return "neu";
    case "in_production":
    case "ready":
      return "fertig";
    case "out_for_delivery":
    case "delivery_failed":
      return "unterwegs";
    case "delivered":
    case "cancelled":
      return "geliefert";
  }
}

export function KundenView({
  customers,
  initialDetail,
  initialQuery,
}: {
  customers: KundeListItem[];
  initialDetail: KundeDetailData | null;
  initialQuery: string;
}) {
  const [q, setQ] = useState(initialQuery);
  const [view, setView] = useState<"list" | "detail">(
    initialDetail ? "detail" : "list",
  );
  const [selectedId, setSelectedId] = useState<number | null>(
    initialDetail?.id ?? customers[0]?.id ?? null,
  );
  const [confirming, setConfirming] = useState(false);
  const viaListRef = useRef(false);

  // Hash sync for mobile deep-linking + back button.
  useEffect(() => {
    function fromHash() {
      const m = /^#kunde-(\d+)$/.exec(location.hash);
      if (m) {
        const id = Number(m[1]);
        if (customers.some((c) => c.id === id)) {
          setSelectedId(id);
          setView("detail");
          setConfirming(false);
          return;
        }
      }
      setView("list");
      setConfirming(false);
    }
    window.addEventListener("hashchange", fromHash);
    fromHash();
    return () => window.removeEventListener("hashchange", fromHash);
  }, [customers]);

  const visible = useMemo(() => {
    if (!q) return customers;
    const needle = q.trim().toLowerCase();
    return customers.filter((c) =>
      (c.name + " " + c.email + " " + (c.phone ?? ""))
        .toLowerCase()
        .includes(needle),
    );
  }, [customers, q]);

  function select(id: number) {
    viaListRef.current = true;
    // Setting location.hash is the point — DOM-level navigation that
    // fires 'hashchange' and participates in browser history, which is
    // what powers the phone back button. The React Compiler plugin
    // doesn't like external mutation; this is a legitimate exception.
    // eslint-disable-next-line react-hooks/immutability
    window.location.hash = `kunde-${id}`;
  }

  function back() {
    if (viaListRef.current) {
      viaListRef.current = false;
      history.back();
    } else {
      window.location.hash = "";
    }
  }

  const detail = useMemo(() => {
    if (selectedId == null) return null;
    if (initialDetail && initialDetail.id === selectedId) return initialDetail;
    return null;
  }, [selectedId, initialDetail]);

  // No matching detail cached → prompt for the server fetch via URL.
  // In practice the user picks from the list and we already have
  // initialDetail for the first customer only. For a new selection,
  // we push the hash and let Next.js rerender with that selected.
  useEffect(() => {
    if (view === "detail" && selectedId != null && detail == null) {
      const sp = new URLSearchParams();
      if (q) sp.set("q", q);
      sp.set("selected", String(selectedId));
      const url = sp.toString()
        ? `/admin/kunden?${sp.toString()}#kunde-${selectedId}`
        : `/admin/kunden#kunde-${selectedId}`;
      // Keep client state; just update history to let server resolve
      // on the next full navigation.
      history.replaceState(null, "", url);
    }
  }, [view, selectedId, detail, q]);

  return (
    <div className="cust" data-view={view}>
      <div className="cust__list">
        <div className="field-search">
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

        {visible.length === 0 ? (
          <p className="empty">Kein Kunde gefunden.</p>
        ) : (
          <ul className="clist">
            {visible.map((c) => {
              const sub =
                c.orderCount === 0
                  ? "Noch keine Bestellung"
                  : `${c.orderCount} ${c.orderCount === 1 ? "Bestellung" : "Bestellungen"}${c.city ? ` · ${c.city}` : ""}`;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="citem"
                    aria-current={c.id === selectedId ? "true" : undefined}
                    onClick={() => select(c.id)}
                  >
                    <span className="avatar" aria-hidden>
                      {initials(c.name)}
                    </span>
                    <span className="citem__text">
                      <span className="citem__name">
                        {c.anonymised ? "Gelöschter Kunde" : c.name}
                      </span>
                      <span className="citem__sub">
                        {c.anonymised ? "–" : sub}
                      </span>
                    </span>
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
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <section className="cdetail" aria-live="polite" aria-label="Kunde">
        {detail == null ? (
          <p className="muted">
            {customers.length === 0
              ? "Noch keine Kunden."
              : "Bitte einen Kunden wählen."}
          </p>
        ) : (
          <>
            <button
              type="button"
              className="cdetail__back"
              onClick={back}
            >
              <svg
                className="icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M15 6l-6 6 6 6" />
              </svg>
              Alle Kunden
            </button>
            <div className="cdetail__head">
              <span className="avatar" aria-hidden>
                {initials(detail.name)}
              </span>
              <div>
                <h2>{detail.name}</h2>
                <p>Kunde seit {detail.since}</p>
              </div>
            </div>

            <div className="contact">
              {detail.phone && (
                <Link
                  className="btn"
                  href={`tel:${detail.phone.replace(/\s/g, "")}`}
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
                    <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z" />
                  </svg>
                  <span>{detail.phone}</span>
                </Link>
              )}
              <Link className="btn" href={`mailto:${detail.email}`}>
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
                  <rect x="3" y="5" width="18" height="14" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                <span>{detail.email}</span>
              </Link>
            </div>

            {detail.address && (
              <div>
                <h3>Adresse</h3>
                <p className="cdetail__addr">{detail.address}</p>
              </div>
            )}

            <div>
              <h3>Bestellungen</h3>
              {detail.orders.length === 0 ? (
                <p className="muted">Noch keine Bestellungen.</p>
              ) : (
                <ul className="corders">
                  {detail.orders.map((o) => {
                    const stage = uiStageFor(o.status);
                    return (
                      <li key={o.id}>
                        <span className="corders__what">
                          <b>{o.what}</b>
                          <span>
                            {o.placedAt} · {formatChf(o.price)}
                          </span>
                        </span>
                        <span className={`st st--${stage}`}>
                          {UI_LABEL[stage]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {confirming ? (
              <div className="confirm" role="alertdialog" aria-labelledby="del-q">
                <p id="del-q">
                  <strong>Daten von {detail.name} löschen?</strong> Name,
                  E-Mail, Telefon und Passwort werden gelöscht. Die
                  Bestellungen bleiben. Das kann man nicht rückgängig
                  machen.
                </p>
                <div>
                  <form action={anonymiseCustomerFromKundenAction}>
                    <input type="hidden" name="email" value={detail.email} />
                    <input type="hidden" name="customerId" value={detail.id} />
                    <input type="hidden" name="confirm" value="yes" />
                    <button type="submit" className="btn btn--danger">
                      Ja, löschen
                    </button>
                  </form>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setConfirming(false)}
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="btn-link btn-link--danger"
                onClick={() => setConfirming(true)}
              >
                Kundendaten löschen
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
