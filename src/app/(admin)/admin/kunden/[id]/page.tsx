import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { fetchCustomerDetail } from "@/lib/admin/customers";
import { statusLabelDe } from "@/lib/admin/heute";
import { formatChf } from "@/lib/money";
import { AnonymiseCustomerForm } from "../../einstellungen/_components/anonymise-customer";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * Admin per-customer detail. Everything a florist might ask:
 *   - who is this
 *   - what have they ordered (and where)
 *   - what addresses do they have saved
 *   - how to anonymise if they request erasure
 */
export default async function KundeDetailPage({ params }: PageProps) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) notFound();

  const data = await fetchCustomerDetail(id);
  if (!data) notFound();

  const name =
    [data.firstName, data.lastName].filter(Boolean).join(" ") || data.email;
  const since = DateTime.fromJSDate(data.createdAt, { zone: "Europe/Zurich" })
    .setLocale("de-CH")
    .toFormat("d. LLLL yyyy");
  const anonAt = data.anonymisedAt
    ? DateTime.fromJSDate(data.anonymisedAt, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("d. LLLL yyyy")
    : null;

  const totalSpend = data.orders.reduce(
    (acc, o) => acc + Number(o.totalGross),
    0,
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* Back + header */}
      <div>
        <Link
          href="/admin/kunden"
          className="text-xs tracking-[0.1em] uppercase text-muted-foreground hover:text-rose transition-colors inline-flex items-center gap-1 group"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
            ←
          </span>
          Kunden
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-display font-light text-[clamp(1.8rem,3vw,2.4rem)] leading-tight">
              {name}
            </h1>
            {anonAt && (
              <p className="mt-1 inline-block text-[0.68rem] tracking-[0.1em] uppercase px-2 py-0.5 bg-stone-100 text-stone-700 border border-stone-200 rounded">
                anonymisiert am {anonAt}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Profile card */}
      <section className="rounded-lg border bg-card p-5 space-y-3">
        <h2 className="text-xs tracking-[0.14em] uppercase font-medium text-muted-foreground">
          Profil
        </h2>
        <dl className="grid gap-y-2 gap-x-6 sm:grid-cols-2 text-sm">
          <Row label="E-Mail" value={data.email} muted={data.anonymisedAt != null} />
          <Row label="Telefon" value={data.phone ?? "–"} />
          <Row label="Kunden-ID" value={String(data.id)} mono />
          <Row label="Registriert" value={since} />
          <Row
            label="E-Mail verifiziert"
            value={data.emailVerifiedAt ? "Ja" : "Nein"}
          />
          <Row
            label="Umsatz gesamt"
            value={formatChf(totalSpend.toFixed(2))}
            strong
          />
        </dl>
      </section>

      {/* Orders */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs tracking-[0.14em] uppercase font-medium text-muted-foreground">
            Bestellungen
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {data.orders.length} {data.orders.length === 1 ? "Eintrag" : "Einträge"}
          </span>
        </div>
        {data.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Bestellungen — Konto registriert, aber noch nicht genutzt.
          </p>
        ) : (
          <ul className="divide-y divide-mist border-y border-mist">
            {data.orders.map((o) => (
              <li key={o.id}>
                <OrderRow order={o} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Addresses */}
      <section className="space-y-3">
        <h2 className="text-xs tracking-[0.14em] uppercase font-medium text-muted-foreground">
          Adressen im Adressbuch
        </h2>
        {data.addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine gespeicherten Adressen.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.addresses.map((a) => (
              <li
                key={a.id}
                className="rounded-md border bg-card p-3 text-sm space-y-1"
              >
                {a.labelDe && (
                  <div className="text-[0.62rem] tracking-[0.12em] uppercase text-muted-foreground">
                    {a.labelDe}
                  </div>
                )}
                <div className="font-medium">{a.recipientName}</div>
                <div className="text-xs text-muted-foreground leading-snug">
                  {a.street}
                  <br />
                  {a.plz} {a.city}
                </div>
                {a.phone && (
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {a.phone}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone */}
      {!data.anonymisedAt && (
        <section className="rounded-lg border border-rose-200 bg-rose-50/40 p-5 space-y-3">
          <h2 className="text-xs tracking-[0.14em] uppercase font-medium text-rose-700">
            Datenschutz · Art. 32 revDSG
          </h2>
          <p className="text-sm text-bark/80 leading-relaxed">
            Anonymisiert die persönlichen Felder dieses Kontos (Name, E-Mail,
            Telefon, Passwort). Bestellungen bleiben wegen der 10-jährigen
            Aufbewahrungspflicht erhalten — mit den damals erfassten Daten als
            Snapshot. Nicht rückgängig zu machen.
          </p>
          <div className="pt-1">
            <AnonymiseCustomerForm defaultEmail={data.email} />
          </div>
        </section>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  mono,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  mono?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={`${muted ? "text-muted-foreground" : "text-foreground"} ${
          mono ? "font-mono tabular-nums text-xs" : ""
        } ${strong ? "font-medium" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

function OrderRow({
  order: o,
}: {
  order: NonNullable<
    Awaited<ReturnType<typeof fetchCustomerDetail>>
  >["orders"][number];
}) {
  const placed = DateTime.fromJSDate(o.placedAt, { zone: "Europe/Zurich" })
    .setLocale("de-CH")
    .toFormat("d. LLL yyyy");
  const delivery = o.deliveryDate
    ? DateTime.fromISO(o.deliveryDate, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("ccc d. LLL")
    : null;

  return (
    <Link
      href={`/admin/bestellung/${encodeURIComponent(o.orderNumber)}`}
      className="grid grid-cols-[1fr_auto] gap-4 py-3 items-center hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-mono tabular-nums text-sm">{o.orderNumber}</span>
          <span className="text-xs text-muted-foreground">{placed}</span>
        </div>
        <div className="text-sm mt-0.5">
          An: <span className="font-medium">{o.recipientName}</span>
          {o.deliveryCity && (
            <span className="text-muted-foreground ml-2">
              · {o.deliveryPlz} {o.deliveryCity}
            </span>
          )}
        </div>
        {delivery && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Lieferung {delivery}
          </div>
        )}
      </div>
      <div className="text-right">
        <div className="text-sm font-medium tabular-nums">
          {formatChf(o.totalGross)}
        </div>
        <div className="text-[0.65rem] tracking-[0.08em] uppercase text-muted-foreground mt-0.5">
          {statusLabelDe(o.status)}
        </div>
      </div>
    </Link>
  );
}
