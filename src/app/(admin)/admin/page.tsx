import { DateTime } from "luxon";
import { auth } from "@/auth";
import {
  HeuteDayPicker,
  type DayTab,
} from "@/components/admin/heute-day-picker";
import { OrderCard, PrintButton } from "@/components/admin/order-card";
import type { OrderCardData } from "@/components/admin/order-card";
import {
  fetchActionableOrdersInRange,
  type ActionableOrder,
} from "@/lib/admin/heute";
import { todayZ } from "@/lib/checkout/time";

export const dynamic = "force-dynamic";

const RANGE_PAST_DAYS = 7;
const RANGE_FUTURE_DAYS = 60;

const DOW_LONG = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
] as const;
const MON_LONG = [
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

const TOUR_ORDER = ["am", "event", "pm"] as const;
type Tour = (typeof TOUR_ORDER)[number];

function tourOf(o: ActionableOrder): Tour | "other" {
  if (o.fulfilment === "timed") return "event";
  if (o.fulfilment === "run") {
    if (o.sortTime?.startsWith("10")) return "am";
    if (o.sortTime?.startsWith("16")) return "pm";
  }
  return "other";
}

const TOUR_LABEL: Record<Tour | "other", { name: string; sub: string }> = {
  am: { name: "Vormittag", sub: "10–12 Uhr" },
  event: { name: "Anlass", sub: "feste Uhrzeit" },
  pm: { name: "Nachmittag", sub: "16–18 Uhr" },
  other: { name: "Weitere Termine", sub: "" },
};

function toCardData(o: ActionableOrder): OrderCardData {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    fulfilment: o.fulfilment,
    recipientName: o.recipientName,
    recipientPhone: o.recipientPhone,
    buyerName: o.buyerName,
    buyerPhone: o.buyerPhone,
    deliveryStreet: o.deliveryStreet,
    deliveryPlz: o.deliveryPlz,
    deliveryCity: o.deliveryCity,
    deliveryWard: o.deliveryWard,
    deliveryRoom: o.deliveryRoom,
    requestedDeliveryAt: o.requestedDeliveryAt,
    totalGross: o.totalGross,
    paymentMethod: o.paymentMethod,
    firstLineProductName: o.firstLineProductName,
    firstLineVariantLabel: o.firstLineVariantLabel,
    firstLineImageUrl: o.firstLineImageUrl,
    cardMessage: o.cardMessage,
    deliveryInstructions: o.deliveryInstructions,
  };
}

export default async function BestellungenPage(props: {
  searchParams: Promise<{ tag?: string }>;
}) {
  await auth();
  const sp = await props.searchParams;

  const today = todayZ();
  const todayIso = today.toISODate() ?? "";
  const fromIso =
    today.minus({ days: RANGE_PAST_DAYS }).toISODate() ?? todayIso;
  const toIso = today.plus({ days: RANGE_FUTURE_DAYS }).toISODate() ?? todayIso;

  const orders = await fetchActionableOrdersInRange(fromIso, toIso);

  const ordersByDate = new Map<string, ActionableOrder[]>();
  for (const o of orders) {
    const key = o.deliveryDate ?? "unbekannt";
    const existing = ordersByDate.get(key);
    if (existing) existing.push(o);
    else ordersByDate.set(key, [o]);
  }
  const datesWithOrders = Array.from(ordersByDate.keys())
    .filter((k) => k !== "unbekannt")
    .sort();

  const currentIso =
    sp.tag && datesWithOrders.includes(sp.tag)
      ? sp.tag
      : datesWithOrders.includes(todayIso)
        ? todayIso
        : datesWithOrders[0] ?? todayIso;

  const allDays = new Set<string>(datesWithOrders);
  allDays.add(todayIso);
  const days: DayTab[] = Array.from(allDays)
    .sort()
    .map((iso) => ({
      iso,
      label: shortDayLabel(iso, todayIso),
      count: ordersByDate.get(iso)?.length ?? 0,
    }));

  const dayOrders = ordersByDate.get(currentIso) ?? [];
  const title = longDayLabel(currentIso);

  const byTour: Record<Tour | "other", ActionableOrder[]> = {
    am: [],
    event: [],
    pm: [],
    other: [],
  };
  for (const o of dayOrders) byTour[tourOf(o)].push(o);

  // Within each tour: delivered orders go to the bottom.
  for (const key of Object.keys(byTour) as (Tour | "other")[]) {
    byTour[key].sort((a, b) => {
      const aDone = a.status === "delivered" ? 1 : 0;
      const bDone = b.status === "delivered" ? 1 : 0;
      return aDone - bDone;
    });
  }

  const totalDone = dayOrders.filter((o) => o.status === "delivered").length;
  const totalCount = dayOrders.length;
  const progressPct =
    totalCount === 0 ? 0 : Math.round((totalDone / totalCount) * 100);

  return (
    <div className="adm-wrap">
      <div className="adm-head">
        <div>
          <h1>Bestellungen</h1>
          <p>{title}</p>
        </div>
        <div className="adm-head__actions">
          <PrintButton />
        </div>
      </div>

      <div className="day-row">
        <HeuteDayPicker days={days} currentIso={currentIso} />
        {totalCount > 0 && (
          <div className="progress" aria-label="Fortschritt">
            <span className="progress__bar">
              <span style={{ width: `${progressPct}%` }} />
            </span>
            <span>
              {totalDone} von {totalCount} geliefert
            </span>
          </div>
        )}
      </div>

      {totalCount === 0 ? (
        <p className="empty">
          <strong>Keine Lieferungen</strong>
          Neue Bestellungen erscheinen hier automatisch.
        </p>
      ) : (
        <div className="tours">
          {TOUR_ORDER.map((tour) => {
            const group = byTour[tour];
            if (group.length === 0) return null;
            const label = TOUR_LABEL[tour];
            return (
              <section key={tour} aria-label={label.name}>
                <div className="tour">
                  <h2>{label.name}</h2>
                  {label.sub && <span>{label.sub}</span>}
                </div>
                <div className="orders">
                  {group.map((o) => (
                    <OrderCard key={o.id} data={toCardData(o)} />
                  ))}
                </div>
              </section>
            );
          })}
          {byTour.other.length > 0 && (
            <section aria-label={TOUR_LABEL.other.name}>
              <div className="tour">
                <h2>{TOUR_LABEL.other.name}</h2>
              </div>
              <div className="orders">
                {byTour.other.map((o) => (
                  <OrderCard key={o.id} data={toCardData(o)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function shortDayLabel(iso: string, todayIso: string): string {
  const d = DateTime.fromISO(iso, { zone: "Europe/Zurich" });
  const t = DateTime.fromISO(todayIso, { zone: "Europe/Zurich" });
  const diff = Math.round(d.startOf("day").diff(t.startOf("day"), "days").days);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  if (diff === -1) return "Gestern";
  if (diff === 2) return "Übermorgen";
  return d.setLocale("de-CH").toFormat("ccc d. LLL");
}

function longDayLabel(iso: string): string {
  const d = DateTime.fromISO(iso, { zone: "Europe/Zurich" });
  return `${DOW_LONG[d.weekday % 7]}, ${d.day}. ${MON_LONG[d.month - 1]}`;
}
