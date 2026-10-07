import type { Metadata } from "next";
import Link from "next/link";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import { searchOrders, type SearchResult } from "@/lib/admin/search";
import {
  contextLabelDe,
  paymentDisplayDe,
  statusLabelDe,
} from "@/lib/admin/heute";
import { formatChf } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Suche",
  robots: { index: false, follow: false },
};

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await auth();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const results = query ? await searchOrders(query) : [];

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Heute
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">Suche</h1>
        {query ? (
          <p className="text-sm text-muted-foreground mt-1">
            {results.length === 0
              ? `Keine Treffer für «${query}».`
              : `${results.length} ${results.length === 1 ? "Treffer" : "Treffer"} für «${query}».`}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">
            Suche nach Telefonnummer, Bestellnummer oder Name.
          </p>
        )}
      </header>

      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((o) => (
            <li key={o.id}>
              <ResultRow result={o} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResultRow({ result: o }: { result: SearchResult }) {
  const slot = buildShortSlot(o);
  const isCancelled = o.status === "cancelled";

  return (
    <Link
      href={`/admin/bestellung/${encodeURIComponent(o.orderNumber)}`}
      className={`block rounded-md border p-3 hover:bg-muted/60 transition-colors ${
        isCancelled ? "opacity-50" : ""
      }`}
    >
      <div className="grid grid-cols-[1fr_auto] gap-3 sm:gap-4 items-start">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-sm">{o.recipientName}</span>
            {o.deliveryContext !== "residential" && (
              <ContextChip context={o.deliveryContext} />
            )}
            <StatusChip status={o.status} />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {[o.deliveryStreet, o.deliveryPlz, o.deliveryCity]
              .filter(Boolean)
              .join(", ")}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span className="font-medium tabular-nums text-foreground">
              {o.orderNumber}
            </span>
            {o.buyerPhone && (
              <a
                href={`tel:${o.buyerPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-foreground tabular-nums"
                title={`Käufer: ${o.buyerName}`}
              >
                {o.buyerPhone}
              </a>
            )}
            <span>
              {DateTime.fromJSDate(o.placedAt, { zone: "Europe/Zurich" })
                .setLocale("de-CH")
                .toFormat("ccc d. LLL yyyy")}
            </span>
            {slot && <span>{slot}</span>}
          </div>
        </div>

        <div className="text-right flex flex-col items-end gap-1">
          <span className="font-medium tabular-nums text-sm">
            {formatChf(o.totalGross)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {paymentDisplayDe(o.paymentStatus, o.paymentMethod)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function buildShortSlot(o: SearchResult): string | null {
  if (o.fulfilment === "timed" && o.requestedDeliveryAt) {
    return DateTime.fromJSDate(o.requestedDeliveryAt, {
      zone: "Europe/Zurich",
    })
      .setLocale("de-CH")
      .toFormat("ccc d. LLL HH:mm");
  }
  if (o.deliveryDate) {
    const d = DateTime.fromISO(o.deliveryDate, { zone: "Europe/Zurich" })
      .setLocale("de-CH")
      .toFormat("ccc d. LLL");
    const w = o.sortTime
      ? o.sortTime.startsWith("10")
        ? " Vorm"
        : o.sortTime.startsWith("16")
          ? " Nachm"
          : ""
      : "";
    return d + w;
  }
  return null;
}

function StatusChip({ status }: { status: SearchResult["status"] }) {
  const tone =
    status === "delivered"
      ? "bg-slate-100 text-slate-700 border-slate-200"
      : status === "out_for_delivery"
        ? "bg-sky-100 text-sky-700 border-sky-200"
        : status === "ready"
          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
          : status === "in_production"
            ? "bg-amber-100 text-amber-700 border-amber-200"
            : status === "delivery_failed"
              ? "bg-rose-100 text-rose-700 border-rose-200"
              : status === "cancelled"
                ? "bg-slate-100 text-slate-500 border-slate-200 line-through"
                : "bg-stone-100 text-stone-700 border-stone-200";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${tone}`}
    >
      {statusLabelDe(status)}
    </span>
  );
}

function ContextChip({
  context,
}: {
  context: SearchResult["deliveryContext"];
}) {
  const tone =
    context === "funeral"
      ? "bg-rose-100 text-rose-700 border-rose-200"
      : context === "hospital"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-slate-100 text-slate-700 border-slate-200";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${tone}`}
    >
      {contextLabelDe(context)}
    </span>
  );
}
