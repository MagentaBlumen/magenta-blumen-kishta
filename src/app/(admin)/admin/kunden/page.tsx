import Link from "next/link";
import { DateTime } from "luxon";
import { fetchCustomerDetail, fetchCustomerList } from "@/lib/admin/customers";
import { statusLabelDe } from "@/lib/admin/heute";
import { formatChf } from "@/lib/money";
import {
  KundenList,
  type KundeListItem,
} from "@/components/admin/kunden-list";
import { anonymiseCustomerFromKundenAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    selected?: string;
    confirm?: string;
    dsg?: string;
  }>;
};

// Admin Kunden split-pane. Left: searchable list. Right: selected
// customer detail (contact + orders + anonymise confirm).
//
// URL state:
//   ?q=<filter>        — server-side search
//   ?selected=<id>     — right-pane customer id
//   ?confirm=1         — show the 'wirklich löschen?' confirm box
//   ?dsg=ok|notfound|invalid — post-anonymise flash
export default async function KundenPage({ searchParams }: PageProps) {
  const { q, selected, confirm, dsg } = await searchParams;
  const query = (q ?? "").trim();
  const list = await fetchCustomerList(query);

  const customers: KundeListItem[] = list.map((r) => ({
    id: r.id,
    name:
      [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email,
    email: r.email,
    phone: r.phone,
    orderCount: r.orderCount,
    anonymised: r.anonymisedAt != null,
  }));

  // Resolve selected: explicit param > first list row > null.
  const selectedIdRaw = selected ? Number(selected) : NaN;
  const selectedId = Number.isFinite(selectedIdRaw)
    ? selectedIdRaw
    : customers[0]?.id ?? null;

  const detail =
    selectedId != null ? await fetchCustomerDetail(selectedId) : null;

  const subline =
    query && list.length > 0
      ? `${list.length} ${list.length === 1 ? "Treffer" : "Treffer"} für «${query}»`
      : `${customers.length} ${customers.length === 1 ? "Kunde" : "Kunden"}`;

  return (
    <>
      <div className="adm-head">
        <div className="adm-head__text">
          <h1 className="adm-title">Kunden</h1>
          <p className="adm-sub">{subline}</p>
        </div>
      </div>

      {dsg === "notfound" && (
        <p className="alert" role="alert">
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
            <path d="M12 3l10 18H2z" />
            <path d="M12 10v5M12 18v.5" />
          </svg>
          <span>Diese Kund:in wurde nicht gefunden.</span>
        </p>
      )}

      <div className="cust">
        <KundenList
          customers={customers}
          selectedId={selectedId}
          initialQuery={query}
        />

        {detail ? (
          <KundeDetailPanel
            detail={detail}
            confirming={confirm === "1"}
            justDone={dsg === "ok" && detail.anonymisedAt != null}
          />
        ) : (
          <aside className="cdetail" aria-live="polite" aria-label="Kunde">
            <p className="muted">Keine Kund:in ausgewählt.</p>
          </aside>
        )}
      </div>
    </>
  );
}

type Detail = NonNullable<Awaited<ReturnType<typeof fetchCustomerDetail>>>;

function KundeDetailPanel({
  detail,
  confirming,
  justDone,
}: {
  detail: Detail;
  confirming: boolean;
  justDone: boolean;
}) {
  const isAnon = detail.anonymisedAt != null;
  const name =
    [detail.firstName, detail.lastName].filter(Boolean).join(" ") ||
    detail.email;
  const since = DateTime.fromJSDate(detail.createdAt, {
    zone: "Europe/Zurich",
  })
    .setLocale("de-CH")
    .toFormat("d. LLLL yyyy");

  const address =
    detail.addresses[0]
      ? `${detail.addresses[0].street}, ${detail.addresses[0].plz} ${detail.addresses[0].city}`
      : null;

  return (
    <section
      className="cdetail"
      aria-live="polite"
      aria-label={`Kunde ${isAnon ? "anonymisiert" : name}`}
    >
      <div>
        <h2 className="cdetail__name">
          {isAnon ? "Gelöschter Kunde" : name}
        </h2>
        <p className="cdetail__since">Kunde seit {since}</p>
      </div>

      {(isAnon || justDone) && (
        <p className="done-msg" role="status">
          <svg
            className="icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12l5 5 9-10" />
          </svg>
          Daten gelöscht.
        </p>
      )}

      {!isAnon && (
        <div className="contact">
          {detail.phone && (
            <Link
              className="btn"
              href={`tel:${detail.phone.replace(/\s/g, "")}`}
            >
              <PhoneIcon /> {detail.phone}
            </Link>
          )}
          <Link className="btn" href={`mailto:${detail.email}`}>
            <MailIcon /> {detail.email}
          </Link>
          {address && <span className="contact__addr">{address}</span>}
        </div>
      )}

      <div>
        <h3>Bestellungen</h3>
        {detail.orders.length === 0 ? (
          <p className="muted">Noch keine Bestellungen.</p>
        ) : (
          <ul className="corders">
            {detail.orders.map((o) => (
              <li key={o.id}>
                <span className="corders__what">
                  <b>
                    {DateTime.fromJSDate(o.placedAt, {
                      zone: "Europe/Zurich",
                    })
                      .setLocale("de-CH")
                      .toFormat("ccc, d. LLL")}{" "}
                    · {o.recipientName}
                  </b>
                  <span>
                    Nr. {o.orderNumber} · {formatChf(o.totalGross)}
                  </span>
                </span>
                <span className={`chip chip--${uiChipFor(o.status)}`}>
                  {statusLabelDe(o.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isAnon && (
        <>
          {confirming ? (
            <AnonymiseConfirm detail={detail} name={name} />
          ) : (
            <Link
              className="btn-link btn-link--danger"
              href={`/admin/kunden?selected=${detail.id}&confirm=1`}
              scroll={false}
            >
              Kundendaten löschen …
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function AnonymiseConfirm({
  detail,
  name,
}: {
  detail: Detail;
  name: string;
}) {
  return (
    <div className="confirm" role="alertdialog" aria-labelledby="del-q">
      <p id="del-q">
        <strong>Daten von {name} löschen?</strong> Name, E-Mail, Telefon
        und Passwort werden gelöscht. Die Bestellungen bleiben. Das kann
        man nicht rückgängig machen.
      </p>
      <div>
        <form action={anonymiseCustomerFromKundenAction}>
          <input type="hidden" name="email" value={detail.email} />
          <input type="hidden" name="customerId" value={detail.id} />
          <input type="hidden" name="confirm" value="yes" />
          <button type="submit" className="btn btn--danger-fill">
            Ja, löschen
          </button>
        </form>
        <Link
          className="btn"
          href={`/admin/kunden?selected=${detail.id}`}
          scroll={false}
        >
          Abbrechen
        </Link>
      </div>
    </div>
  );
}

function uiChipFor(
  status: Detail["orders"][number]["status"],
): "neu" | "fertig" | "unterwegs" | "geliefert" {
  switch (status) {
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

function PhoneIcon() {
  return (
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
  );
}

function MailIcon() {
  return (
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
  );
}
