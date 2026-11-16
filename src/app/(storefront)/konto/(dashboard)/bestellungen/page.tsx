import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import { fetchCustomerOrders } from "@/lib/customer-auth/orders";
import { formatChf } from "@/lib/money";
import { statusLabelDe } from "@/lib/admin/heute";
import type { CustomerOrderRow } from "@/lib/customer-auth/orders";

export default async function KontoOrders() {
  const session = await auth();
  if (!session?.user?.customerId || session.user.role !== "customer") {
    redirect("/konto/anmelden?callbackUrl=/konto/bestellungen");
  }

  const orders = await fetchCustomerOrders(session.user.customerId);

  // Split into two buckets:
  //   Aktuell  = anything not delivered/cancelled, next delivery first
  //              (ongoing out_for_delivery sorts right alongside future
  //              dates on the same deliveryDate column).
  //   Vergangen = delivered + cancelled, most recent first.
  const aktuell = orders
    .filter((o) => o.status !== "delivered" && o.status !== "cancelled")
    .sort((a, b) =>
      (a.deliveryDate ?? "9999-12-31").localeCompare(
        b.deliveryDate ?? "9999-12-31",
      ),
    );
  const vergangen = orders
    .filter((o) => o.status === "delivered" || o.status === "cancelled")
    .sort((a, b) =>
      (b.deliveryDate ?? "").localeCompare(a.deliveryDate ?? ""),
    );

  return (
    <section className="flex flex-col gap-10">
      <h1 className="m-0 font-display font-light text-bark text-[40px] leading-[1.05]">
        Bestellungen
      </h1>

      {orders.length === 0 ? (
        <EmptyOrders />
      ) : (
        <>
          {aktuell.length > 0 && (
            <OrderGroup
              label="Aktuell"
              sub={
                aktuell.length === 1
                  ? "1 Bestellung unterwegs oder geplant"
                  : `${aktuell.length} Bestellungen unterwegs oder geplant`
              }
              orders={aktuell}
            />
          )}
          {vergangen.length > 0 && (
            <OrderGroup
              label="Vergangen"
              sub={
                vergangen.length === 1
                  ? "1 geliefert"
                  : `${vergangen.length} geliefert`
              }
              orders={vergangen}
            />
          )}
        </>
      )}
    </section>
  );
}

function OrderGroup({
  label,
  sub,
  orders,
}: {
  label: string;
  sub: string;
  orders: CustomerOrderRow[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 font-display font-normal text-[22px] lg:text-[26px] text-bark leading-[1.2]">
          {label}
        </h2>
        <span className="text-[13px] text-sage">{sub}</span>
      </header>
      <div className="border border-mist divide-y divide-hair">
        {orders.map((o) => (
          <OrderRow key={o.orderNumber} order={o} />
        ))}
      </div>
    </section>
  );
}

function OrderRow({ order: o }: { order: CustomerOrderRow }) {
  const whenIso = o.deliveryDate ?? null;
  const when = whenIso
    ? DateTime.fromISO(whenIso, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("ccc d. LLL")
    : DateTime.fromJSDate(o.placedAt, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("ccc d. LLL");

  return (
    <div className="px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex-1 min-w-0 basis-[220px] flex flex-col gap-0.5">
        <strong className="text-[15px] font-semibold text-bark">
          Für {o.recipientName}
        </strong>
        <span className="text-[13px] text-sage tabular-nums">
          {when} · Nr. {o.orderNumber}
        </span>
      </div>
      <StatusChip status={o.status} />
      <span className="font-display text-[20px] min-w-[100px] text-right tabular-nums text-bark">
        {formatChf(o.totalGross)}
      </span>
      <Link
        href={`/bestellung-finden/${o.orderNumber}`}
        className="underline text-[13px] text-sage hover:text-rose transition-colors"
      >
        Details
      </Link>
    </div>
  );
}

function StatusChip({ status }: { status: CustomerOrderRow["status"] }) {
  const delivered = status === "delivered";
  const cancelled = status === "cancelled";
  return (
    <span
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 text-[12px] font-semibold whitespace-nowrap ${
        delivered
          ? "bg-[#EAF3E6] text-[#2F6B3E]"
          : cancelled
            ? "bg-stone-100 text-stone-500 line-through"
            : "bg-[#FBEAF1] text-rose"
      }`}
    >
      {delivered && <span aria-hidden>✓</span>}
      {statusLabelDe(status)}
    </span>
  );
}

function EmptyOrders() {
  return (
    <div className="border border-dashed border-oak p-10 text-center flex flex-col gap-4 items-center">
      <p className="text-[15px] text-bark m-0">
        Noch keine Bestellungen auf diesem Konto.
      </p>
      <Link
        href="/kategorie/alle-anlaesse"
        className="mt-2 inline-flex items-center gap-2 h-11 px-5 bg-bark text-ivory text-[13px] font-semibold tracking-[0.14em] uppercase hover:bg-rose transition-colors"
      >
        Zum Sortiment
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
