import "server-only";
import { and, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "@/db/client";
import {
  blackoutDate,
  deliveryRun,
  weeklySchedule,
} from "@/db/schema/delivery";
import { order } from "@/db/schema/order";
import { product } from "@/db/schema/catalogue";
import { settings } from "@/db/schema/settings";
import { readCartCookie } from "@/lib/cart/cookie";
import {
  ZONE,
  dayOfWeek,
  fromIsoDate,
  nowZ,
  runStartAt,
  shortDateDe,
  shortTimeLabel,
  todayZ,
} from "./time";

/**
 * The seven-condition slot rule + timed hour capacity.
 *
 * Every arithmetic step is in Europe/Zurich (rule 5). Every capacity
 * check is best-effort DISPLAY here - the real FOR UPDATE lock happens
 * at reserve time (5f). A slot that looks free here can still fill
 * between "shown as available" and "customer clicks", and that's why
 * the transaction-level lock exists.
 */

// -------- Public shapes ------------------------------------------

export type SlotStatus =
  | { kind: "available" }
  | { kind: "disabled"; reasonDe: string };

export type RunSlotView = {
  runId: number;
  runDate: string;      // YYYY-MM-DD
  windowStart: string;  // '10:00' | '16:00'
  windowEnd: string;    // '12:00' | '18:00'
  windowLabelDe: string; // 'Vormittag 10-12' | 'Nachmittag 16-18'
  status: SlotStatus;
};

export type RunSlotDay = {
  runDate: string;
  weekdayLabelDe: string;   // 'Fr 25. Sep.'
  slots: RunSlotView[];
};

export type TimedSlotHour = {
  /** ISO with tz offset - stored on order.requested_delivery_at */
  isoStart: string;
  hourLabelDe: string;      // '14:00'
  status: SlotStatus;
};

export type TimedSlotDay = {
  runDate: string;
  weekdayLabelDe: string;
  hours: TimedSlotHour[];
};

// -------- Settings loader ----------------------------------------

type SlotSettings = {
  horizonDays: number;
  timedPerHour: number;
};

async function loadSlotSettings(): Promise<SlotSettings> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(
      inArray(settings.key, [
        "max_booking_horizon_days",
        "timed_deliveries_per_hour",
      ]),
    );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    horizonDays: intOr(map.get("max_booking_horizon_days"), 30),
    timedPerHour: intOr(map.get("timed_deliveries_per_hour"), 3),
  };
}

function intOr(s: string | undefined, fallback: number): number {
  if (!s) return fallback;
  const n = Number(s);
  return Number.isInteger(n) ? n : fallback;
}

// -------- Cart lead-time -----------------------------------------
//
// Rule 4 of the seven: run_date >= today + MAX(lead_time_days) over
// every product currently in the cart. Roses might be 0 days; a fresh
// custom-cut orchid arrangement might be 2. The MOST demanding item
// wins because they ship together.

async function maxCartLeadDays(): Promise<number> {
  const cookie = await readCartCookie();
  if (cookie.l.length === 0) return 0;
  const productIds = Array.from(new Set(cookie.l.map((l) => l.p)));
  const rows = await db
    .select({ leadTimeDays: product.leadTimeDays })
    .from(product)
    .where(inArray(product.id, productIds));
  let max = 0;
  for (const r of rows) {
    if (r.leadTimeDays > max) max = r.leadTimeDays;
  }
  return max;
}

// -------- The main query -----------------------------------------

export async function getAvailableRunSlots(): Promise<RunSlotDay[]> {
  const cfg = await loadSlotSettings();
  const now = nowZ();
  const today = todayZ();
  const horizonEnd = today.plus({ days: cfg.horizonDays });
  const maxLead = await maxCartLeadDays();
  const earliestByLead = today.plus({ days: maxLead });

  // Fetch everything we need in parallel.
  const [runs, weekdays, blackouts] = await Promise.all([
    db
      .select({
        id: deliveryRun.id,
        runDate: deliveryRun.runDate,
        windowStart: deliveryRun.windowStart,
        windowEnd: deliveryRun.windowEnd,
        capacity: deliveryRun.capacity,
        isClosed: deliveryRun.isClosed,
      })
      .from(deliveryRun)
      .where(
        and(
          gte(deliveryRun.runDate, today.toISODate() ?? ""),
          lte(deliveryRun.runDate, horizonEnd.toISODate() ?? ""),
        ),
      )
      .orderBy(deliveryRun.runDate, deliveryRun.windowStart),
    db.select().from(weeklySchedule),
    db
      .select({ day: blackoutDate.day })
      .from(blackoutDate)
      .where(
        and(
          gte(blackoutDate.day, today.toISODate() ?? ""),
          lte(blackoutDate.day, horizonEnd.toISODate() ?? ""),
        ),
      ),
  ]);

  // Booked counts per run - rule 6: COUNT(*), no counter column,
  // matches the FOR UPDATE reserve query in 5f.
  const runIds = runs.map((r) => r.id);
  const bookedByRun = new Map<number, number>();
  if (runIds.length > 0) {
    const counts = await db
      .select({
        runId: order.deliveryRunId,
        c: sql<number>`count(*)::int`,
      })
      .from(order)
      .where(
        and(inArray(order.deliveryRunId, runIds), ne(order.status, "cancelled")),
      )
      .groupBy(order.deliveryRunId);
    for (const row of counts) {
      if (row.runId == null) continue;
      bookedByRun.set(row.runId, row.c);
    }
  }

  const scheduleByDow = new Map<number, (typeof weekdays)[number]>();
  for (const w of weekdays) scheduleByDow.set(w.weekday, w);

  const blackoutDays = new Set(blackouts.map((b) => b.day));

  // Walk runs -> classify each -> group by date
  const byDate = new Map<string, RunSlotView[]>();
  for (const r of runs) {
    const runDay = fromIsoDate(r.runDate);
    const status = classifyRun({
      run: r,
      runDay,
      runStart: runStartAt(r.runDate, r.windowStart),
      now,
      earliestByLead,
      horizonEnd,
      schedule: scheduleByDow.get(dayOfWeek(runDay)),
      isBlackout: blackoutDays.has(r.runDate),
      maxLead,
      booked: bookedByRun.get(r.id) ?? 0,
    });
    const arr = byDate.get(r.runDate) ?? [];
    arr.push({
      runId: r.id,
      runDate: r.runDate,
      windowStart: shortTimeLabel(r.windowStart),
      windowEnd: shortTimeLabel(r.windowEnd),
      windowLabelDe: labelForWindow(r.windowStart),
      status,
    });
    byDate.set(r.runDate, arr);
  }

  // Emit in date order, dropping days where BOTH slots are disabled by
  // a permanent condition (blackout, delivery not enabled that day).
  // Keeping partial-disabled days (one slot ok, one gone) so the
  // customer sees what's happening on that date.
  const out: RunSlotDay[] = [];
  for (const [date, slots] of byDate.entries()) {
    if (slots.every((s) => isPermanentlyDisabled(s.status))) continue;
    out.push({
      runDate: date,
      weekdayLabelDe: shortDateDe(fromIsoDate(date)),
      slots,
    });
  }
  return out;
}

function isPermanentlyDisabled(s: SlotStatus): boolean {
  if (s.kind === "available") return false;
  // "Geschlossen" and "delivery not enabled" reasons are permanent for
  // that day; capacity / cutoff / lead-time / horizon are shift-of-day
  // and worth surfacing even if the other window is bookable.
  return (
    s.reasonDe === "Geschlossen" ||
    s.reasonDe === "An diesem Wochentag keine Lieferung"
  );
}

function labelForWindow(windowStart: string): string {
  const h = shortTimeLabel(windowStart);
  if (h.startsWith("10")) return "Vormittag 10.12";
  if (h.startsWith("16")) return "Nachmittag 16.18";
  return h;
}

// -------- The seven-condition classifier -------------------------

type ClassifyArgs = {
  run: {
    id: number;
    runDate: string;
    windowStart: string;
    windowEnd: string;
    capacity: number;
    isClosed: boolean;
  };
  runDay: DateTime;
  runStart: DateTime;
  now: DateTime;
  earliestByLead: DateTime;
  horizonEnd: DateTime;
  schedule:
    | {
        weekday: number;
        shopOpen: boolean;
        deliveryEnabled: boolean;
        minLeadHours: number;
      }
    | undefined;
  isBlackout: boolean;
  maxLead: number;
  booked: number;
};

/**
 * Returns { available } iff ALL seven hold.
 * On failure, returns the FIRST-hit reason - short-circuits in the
 * order most useful for a human to understand (per-day reasons before
 * per-slot reasons).
 */
function classifyRun(a: ClassifyArgs): SlotStatus {
  // 1. blackout
  if (a.isBlackout) return { kind: "disabled", reasonDe: "Geschlossen" };

  // 2. weekly delivery enabled
  if (!a.schedule || !a.schedule.deliveryEnabled) {
    return { kind: "disabled", reasonDe: "An diesem Wochentag keine Lieferung" };
  }

  // 5. run manually closed
  if (a.run.isClosed) return { kind: "disabled", reasonDe: "Ausgebucht" };

  // 6. capacity via COUNT(*), matches the reserve query
  if (a.booked >= a.run.capacity) {
    return { kind: "disabled", reasonDe: "Ausgebucht" };
  }

  // 7. horizon
  if (a.runDay > a.horizonEnd) {
    return {
      kind: "disabled",
      reasonDe: "Nur bis einen Monat im Voraus buchbar",
    };
  }

  // 4. per-product lead time
  if (a.runDay < a.earliestByLead) {
    return {
      kind: "disabled",
      reasonDe:
        a.maxLead === 1
          ? "Dieses Produkt benötigt 1 Tag Vorlauf"
          : `Dieses Produkt benötigt ${a.maxLead} Tage Vorlauf`,
    };
  }

  // 3. cutoff (min_lead_hours before window start)
  const earliestBookable = a.now.plus({ hours: a.schedule.minLeadHours });
  if (a.runStart < earliestBookable) {
    // Tuesday's 24-hour rule gets a friendlier message
    if (a.schedule.weekday === 2 && a.schedule.minLeadHours >= 24) {
      return {
        kind: "disabled",
        reasonDe: "Dienstags bitte 24 Stunden im Voraus bestellen",
      };
    }
    return {
      kind: "disabled",
      reasonDe: "Zu kurzfristig - bitte einen späteren Termin wählen",
    };
  }

  return { kind: "available" };
}

// -------- Timed slots (funerals / weddings / events) --------------
//
// One hour buckets between 09:00 and 18:00 on days where delivery is
// enabled and not blacked out. Cap at settings.timed_deliveries_per_hour.
// Same capacity semantics as runs: COUNT(*) not counter.
//
// UI shows the next `horizonDays` days; picker returns a full ISO
// timestamp with Europe/Zurich offset for order.requested_delivery_at.

const TIMED_HOUR_MIN = 9;    // 09:00 earliest ceremony slot
const TIMED_HOUR_MAX = 18;   // last slot starts at 18:00

export async function getAvailableTimedSlots(): Promise<TimedSlotDay[]> {
  const cfg = await loadSlotSettings();
  const now = nowZ();
  const today = todayZ();
  const horizonEnd = today.plus({ days: cfg.horizonDays });
  const maxLead = await maxCartLeadDays();
  const earliestByLead = today.plus({ days: maxLead });

  const [weekdays, blackouts, timedOrders] = await Promise.all([
    db.select().from(weeklySchedule),
    db
      .select({ day: blackoutDate.day })
      .from(blackoutDate)
      .where(
        and(
          gte(blackoutDate.day, today.toISODate() ?? ""),
          lte(blackoutDate.day, horizonEnd.toISODate() ?? ""),
        ),
      ),
    db
      .select({
        requestedAt: order.requestedDeliveryAt,
      })
      .from(order)
      .where(
        and(
          eq(order.fulfilment, "timed"),
          ne(order.status, "cancelled"),
          gte(
            order.requestedDeliveryAt,
            today.toJSDate(),
          ),
          lte(
            order.requestedDeliveryAt,
            horizonEnd.plus({ days: 1 }).toJSDate(),
          ),
        ),
      ),
  ]);

  const scheduleByDow = new Map<number, (typeof weekdays)[number]>();
  for (const w of weekdays) scheduleByDow.set(w.weekday, w);
  const blackoutDays = new Set(blackouts.map((b) => b.day));

  // Booked count per (date, hour) bucket in Europe/Zurich.
  const bookedByHour = new Map<string, number>();
  for (const o of timedOrders) {
    if (!o.requestedAt) continue;
    const dt = DateTime.fromJSDate(o.requestedAt, { zone: ZONE });
    const key = dt.toFormat("yyyy-LL-dd'T'HH");
    bookedByHour.set(key, (bookedByHour.get(key) ?? 0) + 1);
  }

  const out: TimedSlotDay[] = [];
  for (let cursor = today; cursor <= horizonEnd; cursor = cursor.plus({ days: 1 })) {
    const dow = dayOfWeek(cursor);
    const isoDate = cursor.toISODate();
    if (!isoDate) continue;
    const schedule = scheduleByDow.get(dow);
    const isBlackout = blackoutDays.has(isoDate);

    // Day-level filters that kill the whole day.
    if (isBlackout || !schedule || !schedule.deliveryEnabled) continue;
    if (cursor > horizonEnd) continue;

    // Per-lead day filter.
    if (cursor < earliestByLead) continue;

    const hours: TimedSlotHour[] = [];
    for (let h = TIMED_HOUR_MIN; h <= TIMED_HOUR_MAX; h += 1) {
      const start = cursor.set({ hour: h, minute: 0, second: 0 });
      const key = start.toFormat("yyyy-LL-dd'T'HH");
      const status = classifyTimedHour({
        start,
        now,
        minLeadHours: schedule.minLeadHours,
        weekday: dow,
        booked: bookedByHour.get(key) ?? 0,
        cap: cfg.timedPerHour,
      });
      hours.push({
        isoStart: start.toISO() ?? "",
        hourLabelDe: start.toFormat("HH:mm"),
        status,
      });
    }

    // Skip a day if EVERY hour is disabled by cutoff / cap.
    if (hours.every((h) => h.status.kind === "disabled")) continue;

    out.push({
      runDate: isoDate,
      weekdayLabelDe: shortDateDe(cursor),
      hours,
    });
  }

  return out;
}

function classifyTimedHour(args: {
  start: DateTime;
  now: DateTime;
  minLeadHours: number;
  weekday: number;
  booked: number;
  cap: number;
}): SlotStatus {
  // Capacity: 3 per hour by default. This is the DISPLAY-time check;
  // the transactional FOR UPDATE + count in the reserve action (5f)
  // is what actually protects the cap.
  if (args.booked >= args.cap) {
    return { kind: "disabled", reasonDe: "Ausgebucht" };
  }
  // Cutoff. Same rule as runs.
  const earliestBookable = args.now.plus({ hours: args.minLeadHours });
  if (args.start < earliestBookable) {
    if (args.weekday === 2 && args.minLeadHours >= 24) {
      return {
        kind: "disabled",
        reasonDe: "Dienstags bitte 24 Stunden im Voraus bestellen",
      };
    }
    return {
      kind: "disabled",
      reasonDe: "Zu kurzfristig",
    };
  }
  return { kind: "available" };
}
