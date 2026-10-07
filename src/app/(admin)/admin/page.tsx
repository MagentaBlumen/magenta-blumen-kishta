import Link from "next/link";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import {
  contextLabelDe,
  fetchHeuteOrders,
  groupHeuteOrders,
  paymentDisplayDe,
  statusLabelDe,
  type HeuteOrder,
} from "@/lib/admin/heute";
import { formatChf } from "@/lib/money";
import { todayZ } from "@/lib/checkout/time";

export const dynamic = "force-dynamic";

/**
 * The Heute dashboard - what Sandra opens every morning.
 *
 * Shows today's actionable orders grouped by run, plus any orders
 * from previous days that got stuck at ready / out_for_delivery /
 * delivery_failed. Click a row to see the full order detail (lands
 * in chunk 7b).
 *
 * Deliberately dense: Sandra prints the Bons from here and loads the
 * van, so recipient address, buyer phone, and item count need to be
 * glance-readable. Status + payment indicators are badges, not text,
 * for the same reason.
 */
export default async function HeutePage() {
  // Layout double-checks auth, but server actions on this page do too.
  // No action calls here directly yet (chunks 7b-d), but belt + braces.
  await auth();

  const today = todayZ();
  const todayIso = today.toISODate() ?? "";
  const rows = await fetchHeuteOrders();
  const groups = groupHeuteOrders(rows, todayIso);

  const totalCount = rows.length;
  const todayCount = rows.filter((r) => r.deliveryDate === todayIso).length;

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">«Heute»</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {today.setLocale("de-CH").toFormat("cccc, d. LLLL yyyy")}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          <div>
            <span className="text-foreground text-base font-medium tabular-nums">
              {todayCount}
            </span>{" "}
            Bestellungen heute
          </div>
          {totalCount > todayCount && (
            <div className="text-xs">
              + {totalCount - todayCount} Übertrag
            </div>
          )}
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="border border-dashed rounded-md p-10 text-center text-muted-foreground">
          Keine Bestellungen für heute.
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="flex items-end justify-between border-b pb-2">
              <div>
                <h2 className="text-sm font-semibold tracking-wide uppercase">
                  {group.labelDe}
                </h2>
                {group.subLabelDe && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {group.subLabelDe}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {group.orders.length}{" "}
                {group.orders.length === 1 ? "Bestellung" : "Bestellungen"}
              </span>
            </div>
            <ul className="space-y-1">
              {group.orders.map((o) => (
                <li key={o.id}>
                  <OrderRow order={o} isCarryover={group.key === "carryover"} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function OrderRow({
  order,
  isCarryover,
}: {
  order: HeuteOrder;
  isCarryover: boolean;
}) {
  const isDelivered = order.status === "delivered";
  const isFunMoney = order.deliveryContext === "funeral";
  const isHospital = order.deliveryContext === "hospital";

  return (
    <Link
      href={`/admin/bestellung/${encodeURIComponent(order.orderNumber)}`}
      className={`block rounded-md border p-3 hover:bg-muted/60 transition-colors ${
        isDelivered ? "opacity-60" : ""
      } ${isCarryover ? "border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/10" : ""}`}
    >
      <div className="grid grid-cols-[auto_1fr_auto] gap-3 sm:gap-4 items-start">
        {/* Left: route stop (if set) + print indicator */}
        <div className="flex flex-col items-center justify-start pt-0.5 w-10 flex-shrink-0">
          <div className="text-base font-semibold tabular-nums leading-none">
            {order.routeStopOrder ?? "—"}
          </div>
          {order.printedAt && (
            <div
              className="mt-1 text-[10px] text-muted-foreground"
              title="Bon gedruckt"
              aria-label="Bon gedruckt"
            >
              ⎙
            </div>
          )}
        </div>

        {/* Middle: recipient + address + phones + items */}
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-sm">
              {order.recipientName}
            </span>
            {isFunMoney && (
              <Badge tone="rose">Trauer</Badge>
            )}
            {isHospital && <Badge tone="amber">Spital</Badge>}
            {order.deliveryContext === "business" && (
              <Badge tone="slate">Firma</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {[order.deliveryStreet, order.deliveryPlz, order.deliveryCity]
              .filter(Boolean)
              .join(", ")}
            {isHospital && order.deliveryWard
              ? ` · Station ${order.deliveryWard}${order.deliveryRoom ? `, ${order.deliveryRoom}` : ""}`
              : ""}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            <span className="font-medium tabular-nums">{order.orderNumber}</span>
            {order.buyerPhone && (
              <a
                href={`tel:${order.buyerPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-foreground tabular-nums"
              >
                {order.buyerPhone}
              </a>
            )}
            <span>
              {order.itemCount} {order.itemCount === 1 ? "Artikel" : "Artikel"}
            </span>
            {order.fulfilment === "timed" && order.requestedDeliveryAt && (
              <span className="tabular-nums">
                {DateTime.fromJSDate(order.requestedDeliveryAt, {
                  zone: "Europe/Zurich",
                })
                  .setLocale("de-CH")
                  .toFormat("HH:mm")}
              </span>
            )}
          </div>
        </div>

        {/* Right: total + status + payment */}
        <div className="text-right flex flex-col items-end gap-1">
          <span className="font-medium tabular-nums text-sm">
            {formatChf(order.totalGross)}
          </span>
          <StatusBadge status={order.status} />
          <span className="text-[10px] text-muted-foreground">
            {paymentDisplayDe(order.paymentStatus, order.paymentMethod)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function StatusBadge({ status }: { status: HeuteOrder["status"] }) {
  const tone =
    status === "delivered"
      ? "slate"
      : status === "out_for_delivery"
        ? "sky"
        : status === "ready"
          ? "emerald"
          : status === "in_production"
            ? "amber"
            : status === "delivery_failed"
              ? "rose"
              : status === "cancelled"
                ? "slate"
                : "stone";
  return <Badge tone={tone}>{statusLabelDe(status)}</Badge>;
}

function Badge({
  tone,
  children,
}: {
  tone: "stone" | "sky" | "emerald" | "amber" | "rose" | "slate";
  children: React.ReactNode;
}) {
  const classes = {
    stone:
      "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-700",
    sky: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200 border-sky-200 dark:border-sky-800",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800",
    slate:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700",
  }[tone];
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${classes}`}
    >
      {children}
    </span>
  );
}

// contextLabelDe is used for a11y + badge hover titles in later chunks;
// keep the import live.
void contextLabelDe;
