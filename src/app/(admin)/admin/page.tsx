import Link from "next/link";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import {
  HeuteDayPicker,
  type DayTab,
} from "@/components/admin/heute-day-picker";
import {
  NextStepButton,
  PrintButton,
} from "@/components/admin/heute-actions";
import {
  fetchActionableOrdersInRange,
  type ActionableOrder,
} from "@/lib/admin/heute";
import { formatChf } from "@/lib/money";
import { todayZ } from "@/lib/checkout/time";
import { thumbUrl } from "@/lib/image-urls";
import type { OrderStatus } from "@/lib/admin/order-status";

export const dynamic = "force-dynamic";

// Window the Heute dashboard loads: a week back (for carryover /
// recently delivered) and two months forward (booking horizon + buffer).
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

// -------- UI-stage mapping --------
// DB has 8 statuses; the owner thinks in 4. The chip and the next-step
// button both use these display stages.
type UiStage = "neu" | "fertig" | "unterwegs" | "geliefert";

function uiStageFor(s: OrderStatus): UiStage {
  switch (s) {
    case "new":
    case "confirmed":
      return "neu";
    case "in_production":
    case "ready":
      return "fertig";
    case "out_for_delivery":
      return "unterwegs";
    case "delivered":
    case "delivery_failed": // still treated as "unterwegs" visually
      return "unterwegs";
    case "cancelled":
      return "geliefert"; // defensive; cancelled rows are filtered out
  }
}

const UI_STAGE_LABEL: Record<UiStage, string> = {
  neu: "Neu",
  fertig: "Fertig",
  unterwegs: "Unterwegs",
  geliefert: "Geliefert",
};

// Next single-step DB transition, as a (target, button-label) pair.
// Returns null when the pipeline is done (delivered) or error-recovery
// is needed (delivery_failed — admin handles on the detail page).
function dbNext(s: OrderStatus): { target: OrderStatus; label: string } | null {
  switch (s) {
    case "new":
      return { target: "confirmed", label: "Bestätigen" };
    case "confirmed":
      return { target: "in_production", label: "In Produktion" };
    case "in_production":
      return { target: "ready", label: "Strauss ist fertig" };
    case "ready":
      return { target: "out_for_delivery", label: "Losgefahren" };
    case "out_for_delivery":
      return { target: "delivered", label: "Ist geliefert" };
    default:
      return null;
  }
}

// (Undo buttons are deliberately absent on Heute — the state machine
// only moves forward. Exceptional transitions happen on the detail
// page `/admin/bestellung/[number]`.)

// -------- Tour grouping within a day --------
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

const TOUR_LABEL: Record<Tour | "other", string> = {
  am: "Vormittag · 10–12 Uhr",
  pm: "Nachmittag · 16–18 Uhr",
  event: "Anlass mit fester Uhrzeit",
  other: "Weitere Termine",
};

export default async function HeutePage(props: {
  searchParams: Promise<{ tag?: string }>;
}) {
  await auth();
  const sp = await props.searchParams;

  const today = todayZ();
  const todayIso = today.toISODate() ?? "";
  const fromIso =
    today.minus({ days: RANGE_PAST_DAYS }).toISODate() ?? todayIso;
  const toIso =
    today.plus({ days: RANGE_FUTURE_DAYS }).toISODate() ?? todayIso;

  const orders = await fetchActionableOrdersInRange(fromIso, toIso);

  // Group by delivery_date — one tab per date with orders.
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

  // Current day: the tag param if it's present AND it has orders,
  // otherwise today (even if today has no orders — show the empty
  // state), otherwise the first date with orders.
  const currentIso =
    sp.tag && datesWithOrders.includes(sp.tag)
      ? sp.tag
      : datesWithOrders.includes(todayIso)
        ? todayIso
        : datesWithOrders[0] ?? todayIso;

  // Build the day tabs: include today as a tab even when it has zero
  // orders so Sandra can land on 'Heute' and see the empty-state copy.
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
  const title = longDayLabel(currentIso, todayIso);

  // Group within the current day by tour.
  const byTour: Record<Tour | "other", ActionableOrder[]> = {
    am: [],
    event: [],
    pm: [],
    other: [],
  };
  for (const o of dayOrders) byTour[tourOf(o)].push(o);

  return (
    <>
      <div className="adm-head">
        <div className="adm-head__text">
          <h1 className="adm-title">{title.short}</h1>
          <p className="adm-sub">{title.long}</p>
        </div>
        <PrintButton />
      </div>

      <HeuteDayPicker days={days} currentIso={currentIso} />

      {dayOrders.length === 0 ? (
        <p className="empty">
          <strong>Keine Lieferungen.</strong>
          Neue Bestellungen erscheinen hier automatisch.
        </p>
      ) : (
        <div className="orders">
          {TOUR_ORDER.map((tour) => {
            const group = byTour[tour];
            if (group.length === 0) return null;
            return (
              <section key={tour}>
                <h2 className="tour">{TOUR_LABEL[tour]}</h2>
                {group.map((o) =>
                  o.status === "delivered" ? (
                    <DeliveredRow key={o.id} order={o} />
                  ) : (
                    <OrderCard key={o.id} order={o} />
                  ),
                )}
              </section>
            );
          })}
          {byTour.other.length > 0 && (
            <section>
              <h2 className="tour">{TOUR_LABEL.other}</h2>
              {byTour.other.map((o) =>
                o.status === "delivered" ? (
                  <DeliveredRow key={o.id} order={o} />
                ) : (
                  <OrderCard key={o.id} order={o} />
                ),
              )}
            </section>
          )}
        </div>
      )}
    </>
  );
}

// ---------- Day labels ----------

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

function longDayLabel(
  iso: string,
  todayIso: string,
): { short: string; long: string } {
  const d = DateTime.fromISO(iso, { zone: "Europe/Zurich" });
  const t = DateTime.fromISO(todayIso, { zone: "Europe/Zurich" });
  const diff = Math.round(d.startOf("day").diff(t.startOf("day"), "days").days);
  const short =
    diff === 0
      ? "Heute"
      : diff === 1
        ? "Morgen"
        : diff === -1
          ? "Gestern"
          : diff === 2
            ? "Übermorgen"
            : d.setLocale("de-CH").toFormat("cccc");
  const long = `${DOW_LONG[d.weekday % 7]}, ${d.day}. ${MON_LONG[d.month - 1]}`;
  return { short, long };
}

// ---------- Order card ----------

function OrderCard({ order: o }: { order: ActionableOrder }) {
  const stage = uiStageFor(o.status);
  const chipClass = `chip chip--${stage}`;
  const next = dbNext(o.status);

  const placeDetail =
    o.deliveryContext === "hospital" && o.deliveryWard
      ? `Station ${o.deliveryWard}${o.deliveryRoom ? `, Zimmer ${o.deliveryRoom}` : ""}`
      : "";
  const addressLine = [o.deliveryStreet, o.deliveryPlz, o.deliveryCity]
    .filter(Boolean)
    .join(", ");

  const eventText =
    o.fulfilment === "timed" && o.requestedDeliveryAt
      ? `Zeremonie ${DateTime.fromJSDate(o.requestedDeliveryAt, { zone: "Europe/Zurich" }).setLocale("de-CH").toFormat("HH:mm")} Uhr`
      : null;

  const isCash = o.paymentMethod === "cash";

  return (
    <article className="order" aria-label={`Bestellung ${o.orderNumber}`}>
      <div className="order__top">
        <Link
          href={`/admin/bestellung/${encodeURIComponent(o.orderNumber)}`}
          className="order__no"
        >
          Nr. {o.orderNumber}
        </Link>
        <span className={chipClass}>{UI_STAGE_LABEL[stage]}</span>
        {isCash && (
          <span className="chip chip--cash">
            Bar kassieren · {formatChf(o.totalGross)}
          </span>
        )}
        {o.status === "delivery_failed" && (
          <span className="chip chip--neu">Lieferung fehlgeschlagen</span>
        )}
        <div className="order__actions">
          {next && (
            <NextStepButton
              orderNumber={o.orderNumber}
              target={next.target}
              label={next.label}
            />
          )}
        </div>
      </div>
      <div className="order__body">
        <div className="order__what">
          {o.firstLineImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbUrl(o.firstLineImageUrl)} alt="" />
          ) : (
            <div style={{ width: 56, height: 56, background: "var(--a-sand)" }} />
          )}
          <div>
            <span className="order__product">
              {o.firstLineProductName ?? "(Produkt gelöscht)"}
            </span>
            <span className="order__meta">
              {o.firstLineVariantLabel
                ? `${o.firstLineVariantLabel} · `
                : ""}
              {formatChf(o.totalGross)}
              {o.itemCount > 1 ? ` · ${o.itemCount} Positionen` : ""}
            </span>
          </div>
        </div>

        {o.cardMessage ? (
          <p className="order__card">
            «{o.cardMessage}»{o.cardIsAnonymous ? " (anonym)" : ""}
          </p>
        ) : (
          <span aria-hidden />
        )}

        <div className="order__to">
          {eventText && <p className="order__event">{eventText}</p>}
          <span className="order__name">{o.recipientName}</span>
          {addressLine && (
            <span className="order__addr">{addressLine}</span>
          )}
          {placeDetail && <span className="order__place">{placeDetail}</span>}
          {o.recipientPhone && (
            <a
              className="order__tel"
              href={`tel:${o.recipientPhone.replace(/\s/g, "")}`}
            >
              <svg
                className="icon"
                width="17"
                height="17"
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
              {o.recipientPhone}
            </a>
          )}
          {o.deliveryInstructions && (
            <p className="order__note">{o.deliveryInstructions}</p>
          )}
        </div>
      </div>
    </article>
  );
}

function DeliveredRow({ order: o }: { order: ActionableOrder }) {
  return (
    <Link
      href={`/admin/bestellung/${encodeURIComponent(o.orderNumber)}`}
      className="order-done"
    >
      <span className="order-done__ok">
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
        Geliefert
      </span>
      <span className="order-done__text">
        Nr. {o.orderNumber} · {o.recipientName}
        {o.firstLineProductName ? ` · ${o.firstLineProductName}` : ""}
      </span>
    </Link>
  );
}
