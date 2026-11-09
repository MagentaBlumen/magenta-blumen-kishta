import Link from "next/link";
import { DateTime } from "luxon";
import { fetchCustomerList } from "@/lib/admin/customers";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

/**
 * Admin Kunden overview. Lists registered customer accounts. Guest
 * orders (customer_id = NULL on the order) are not here — those are
 * findable via /admin/suche by phone, name, or order number.
 */
export default async function KundenListPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const rows = await fetchCustomerList(query);

  const activeCount = rows.filter((r) => !r.anonymisedAt).length;
  const anonCount = rows.length - activeCount;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[0.65rem] tracking-[0.2em] uppercase text-muted-foreground font-medium mb-1">
            Admin
          </p>
          <h1 className="font-display font-light text-[clamp(1.8rem,3vw,2.4rem)] leading-tight">
            Kunden
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {query
              ? `${rows.length} ${rows.length === 1 ? "Treffer" : "Treffer"} für «${query}»`
              : `${activeCount} aktiv${anonCount > 0 ? ` · ${anonCount} anonymisiert` : ""}`}
          </p>
        </div>
      </div>

      {/* Search */}
      <form action="/admin/kunden" method="get" className="relative max-w-xl">
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Name, E-Mail oder Telefon"
          aria-label="Kunden suchen"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoFocus={!query}
          className="w-full h-10 pl-4 pr-28 border border-input bg-background text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose transition-colors"
        />
        <button
          type="submit"
          className="absolute right-1.5 top-1.5 bottom-1.5 px-4 text-xs tracking-[0.12em] uppercase font-medium bg-foreground text-background hover:bg-rose rounded transition-colors"
        >
          Suchen
        </button>
        {query && (
          <Link
            href="/admin/kunden"
            className="ml-3 inline-block text-xs text-muted-foreground hover:text-foreground mt-2"
          >
            Filter zurücksetzen
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <ul className="divide-y divide-mist border-y border-mist">
          {rows.map((r) => (
            <li key={r.id}>
              <CustomerRow row={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CustomerRow({
  row,
}: {
  row: Awaited<ReturnType<typeof fetchCustomerList>>[number];
}) {
  const name =
    [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email;
  const since = DateTime.fromJSDate(row.createdAt, { zone: "Europe/Zurich" })
    .setLocale("de-CH")
    .toFormat("d. LLL yyyy");
  const initials = initialsFrom(name);
  const isAnon = row.anonymisedAt != null;

  return (
    <Link
      href={`/admin/kunden/${row.id}`}
      className={`grid grid-cols-[auto_1fr_auto] gap-4 py-3 items-center group hover:bg-muted/40 -mx-3 px-3 rounded-md transition-colors ${isAnon ? "opacity-60" : ""}`}
    >
      <span className="flex items-center justify-center w-10 h-10 rounded-full bg-rose/10 text-rose font-display font-medium text-sm">
        {initials}
      </span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-sm">{name}</span>
          {isAnon && (
            <span className="inline-block text-[0.6rem] tracking-[0.1em] uppercase px-1.5 py-0.5 bg-stone-100 text-stone-600 border border-stone-200 rounded">
              anonymisiert
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
          <span className="truncate max-w-[220px]">{row.email}</span>
          {row.phone && <span className="tabular-nums">{row.phone}</span>}
          <span>Seit {since}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium tabular-nums">
          {row.orderCount}
        </div>
        <div className="text-[0.65rem] tracking-[0.08em] uppercase text-muted-foreground">
          {row.orderCount === 1 ? "Bestellung" : "Bestellungen"}
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="rounded-lg border border-dashed border-mist p-10 text-center space-y-2">
      <p className="text-sm text-bark">
        {query
          ? `Keine Kunden zu «${query}» gefunden.`
          : "Noch keine registrierten Kunden."}
      </p>
      <p className="text-xs text-muted-foreground max-w-md mx-auto">
        Die Liste zeigt nur Konten (Signup auf /konto). Gast-Bestellungen
        finden Sie über die{" "}
        <Link href="/admin/suche" className="text-rose hover:underline">
          Bestellung-Suche
        </Link>
        .
      </p>
    </div>
  );
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}
