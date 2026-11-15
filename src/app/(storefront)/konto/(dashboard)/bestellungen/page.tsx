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

  return (
    <section className="flex flex-col gap-7">
      <h1 className="m-0 font-display font-light text-bark text-[40px] leading-[1.05]">
        Bestellungen
      </h1>

      {orders.length === 0 ? (
        <EmptyOrders />
      ) : (
        <div className="border border-[#E1D5C7] divide-y divide-[#E6DDD2]">
          {orders.map((o) => (
            <OrderRow key={o.orderNumber} order={o} />
          ))}
        </div>
      )}
    </section>
  );
}

function OrderRow({ order: o }: { order: CustomerOrderRow }) {
  const placed = DateTime.fromJSDate(o.placedAt, { zone: "Europe/Zurich" })
    .setLocale("de-CH")
    .toFormat("ccc d. LLL");

  return (
    <div className="px-6 py-5 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="flex-1 min-w-0 basis-[220px] flex flex-col gap-0.5">
        <strong className="text-[15px] font-semibold text-bark">
          Für {o.recipientName}
        </strong>
        <span className="text-[13px] text-sage tabular-nums">
          {placed} · Nr. {o.orderNumber}
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
    <div className="border border-dashed border-[#B8916A] p-10 text-center flex flex-col gap-4 items-center">
      <p className="text-[15px] text-bark m-0">
        Noch keine Bestellungen auf diesem Konto.
      </p>
      <p className="text-[13px] text-sage m-0 max-w-md">
        Als Gast bestellt?{" "}
        <Link href="/bestellung-finden" className="text-rose hover:underline">
          Bestellung finden
        </Link>
        .
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
