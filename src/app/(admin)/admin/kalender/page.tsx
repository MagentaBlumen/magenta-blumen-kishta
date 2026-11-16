import Link from "next/link";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import {
  fetchActionableOrdersInRange,
  type ActionableOrder,
} from "@/lib/admin/heute";
import { todayZ } from "@/lib/checkout/time";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;
const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

// Big monthly calendar. One tile per day; each tile shows the count
// of actionable orders and 1-2 chip previews grouped by tour. Clicking
// a tile deep-links to the Heute page filtered to that date.
export default async function AdminKalenderPage({ searchParams }: PageProps) {
  await auth();
  const sp = await searchParams;

  const today = todayZ();
  const todayIso = today.toISODate() ?? "";
  const monthAnchor = parseMonth(sp.month, today);

  // Six-week window that visually covers the month plus leading/
  // trailing days from neighbouring months. ISO weekday Mo=1 … So=7.
  const firstOfMonth = monthAnchor.startOf("month");
  const gridStart = firstOfMonth.minus({ days: firstOfMonth.weekday - 1 });
  const gridEnd = gridStart.plus({ days: 41 }); // 6 weeks × 7 days − 1

  const fromIso = gridStart.toISODate() ?? "";
  const toIso = gridEnd.toISODate() ?? "";
  const orders = await fetchActionableOrdersInRange(fromIso, toIso);

  const byDate = new Map<string, ActionableOrder[]>();
  for (const o of orders) {
    const key = o.deliveryDate ?? "";
    if (!key) continue;
    const bucket = byDate.get(key);
    if (bucket) bucket.push(o);
    else byDate.set(key, [o]);
  }

  const days: DateTime[] = [];
  for (let i = 0; i < 42; i++) days.push(gridStart.plus({ days: i }));

  const prevMonth = monthAnchor.minus({ months: 1 }).toFormat("yyyy-LL");
  const nextMonth = monthAnchor.plus({ months: 1 }).toFormat("yyyy-LL");
  const title = `${MONTHS[monthAnchor.month - 1]} ${monthAnchor.year}`;
  const totalOrders = orders.filter(
    (o) => o.deliveryDate != null && isInMonth(o.deliveryDate, monthAnchor),
  ).length;

  return (
    <>
      <div className="adm-head">
        <div className="adm-head__text">
          <h1 className="adm-title">{title}</h1>
          <p className="adm-sub">
            {totalOrders === 1
              ? "1 Bestellung"
              : `${totalOrders} Bestellungen`}
          </p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link
            href={`/admin/kalender?month=${prevMonth}`}
            className="btn btn--lg"
            aria-label="Vorheriger Monat"
          >
            ←
          </Link>
          <Link
            href="/admin/kalender"
            className="btn btn--lg"
          >
            Heute
          </Link>
          <Link
            href={`/admin/kalender?month=${nextMonth}`}
            className="btn btn--lg"
            aria-label="Nächster Monat"
          >
            →
          </Link>
        </div>
      </div>

      <div className="kal">
        <div className="kal__dows" aria-hidden>
          {WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="kal__grid" role="grid" aria-label={`Kalender ${title}`}>
          {days.map((d) => {
            const iso = d.toISODate() ?? "";
            const inMonth = d.month === monthAnchor.month;
            const dayOrders = byDate.get(iso) ?? [];
            const isToday = iso === todayIso;
            return (
              <DayCell
                key={iso}
                date={d}
                orders={dayOrders}
                inMonth={inMonth}
                isToday={isToday}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}

function DayCell({
  date,
  orders,
  inMonth,
  isToday,
}: {
  date: DateTime;
  orders: ActionableOrder[];
  inMonth: boolean;
  isToday: boolean;
}) {
  const iso = date.toISODate() ?? "";
  const previews = orders.slice(0, 2);
  const overflow = Math.max(0, orders.length - previews.length);

  const classes = ["kal__cell"];
  if (!inMonth) classes.push("is-muted");
  if (isToday) classes.push("is-today");
  if (orders.length === 0) classes.push("is-empty");

  const cellHref = `/admin?tag=${iso}`;
  const content = (
    <>
      <div className="kal__cell-head">
        <span className="kal__date">{date.day}</span>
        {orders.length > 0 && (
          <span className="kal__count">{orders.length}</span>
        )}
      </div>
      <div className="kal__previews">
        {previews.map((o) => (
          <span key={o.id} className={`kal__chip kal__chip--${tourOf(o)}`}>
            {o.recipientName}
          </span>
        ))}
        {overflow > 0 && (
          <span className="kal__more">+{overflow} weitere</span>
        )}
      </div>
    </>
  );

  if (orders.length === 0 && !isToday) {
    return <div className={classes.join(" ")} role="gridcell">{content}</div>;
  }
  return (
    <Link
      href={cellHref}
      className={classes.join(" ")}
      role="gridcell"
      aria-label={`${date.day}. ${MONTHS[date.month - 1]} · ${orders.length} Bestellungen`}
    >
      {content}
    </Link>
  );
}

function tourOf(o: ActionableOrder): "am" | "pm" | "event" | "other" {
  if (o.fulfilment === "timed") return "event";
  if (o.fulfilment === "run") {
    if (o.sortTime?.startsWith("10")) return "am";
    if (o.sortTime?.startsWith("16")) return "pm";
  }
  return "other";
}

function parseMonth(raw: string | undefined, fallback: DateTime): DateTime {
  if (!raw) return fallback.startOf("month");
  const dt = DateTime.fromFormat(raw, "yyyy-LL", { zone: "Europe/Zurich" });
  return dt.isValid ? dt.startOf("month") : fallback.startOf("month");
}

function isInMonth(iso: string, anchor: DateTime): boolean {
  return iso.startsWith(anchor.toFormat("yyyy-LL"));
}
