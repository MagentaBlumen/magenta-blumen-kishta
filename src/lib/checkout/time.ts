import "server-only";
import { DateTime } from "luxon";

/**
 * Europe/Zurich time helpers. NEVER use `new Date()` for slot arithmetic
 * anywhere in this codebase (rule 5). JavaScript's Date is naive about
 * timezones and silently drifts by an hour on the two DST changeover
 * Sundays. Luxon carries the IANA zone through every operation.
 */

export const ZONE = "Europe/Zurich";

/** Current wall-clock in Europe/Zurich. */
export function nowZ(): DateTime {
  return DateTime.now().setZone(ZONE);
}

/** Today's calendar date in Europe/Zurich, at 00:00:00. */
export function todayZ(): DateTime {
  return nowZ().startOf("day");
}

/** ISO date (YYYY-MM-DD) for the given DateTime, in Europe/Zurich. */
export function toIsoDate(dt: DateTime): string {
  const iso = dt.setZone(ZONE).toISODate();
  if (!iso) throw new Error("toIsoDate: invalid DateTime");
  return iso;
}

/**
 * Combine a run's run_date (YYYY-MM-DD) with its window_start ('HH:MM'
 * or 'HH:MM:SS') into a real Europe/Zurich instant.
 *
 * DST-aware: on the spring-forward Sunday there's no 02:30 local, and
 * on fall-back there are two 02:30s. For 10:00 and 16:00 this doesn't
 * bite - but the abstraction has to be right so it doesn't bite when
 * someone changes the window definitions later.
 */
export function runStartAt(runDate: string, windowStart: string): DateTime {
  const dt = DateTime.fromISO(`${runDate}T${normaliseTime(windowStart)}`, {
    zone: ZONE,
  });
  if (!dt.isValid) {
    throw new Error(
      `runStartAt: invalid run_date=${runDate} window_start=${windowStart}: ${dt.invalidReason}`,
    );
  }
  return dt;
}

function normaliseTime(s: string): string {
  // Postgres time returns 'HH:MM:SS'. ISO parser wants HH:MM:SS; give it
  // that form regardless of input.
  const parts = s.split(":");
  const h = parts[0]?.padStart(2, "0") ?? "00";
  const m = parts[1]?.padStart(2, "0") ?? "00";
  const sec = parts[2]?.padStart(2, "0") ?? "00";
  return `${h}:${m}:${sec}`;
}

/** Postgres EXTRACT(DOW) convention: 0 = Sunday, 6 = Saturday. */
export function dayOfWeek(dt: DateTime): number {
  // Luxon weekday: 1 = Monday, 7 = Sunday
  const w = dt.setZone(ZONE).weekday;
  return w === 7 ? 0 : w;
}

/** German weekday label for a given DateTime. */
export function weekdayDe(dt: DateTime): string {
  return dt
    .setZone(ZONE)
    .setLocale("de-CH")
    .toFormat("cccc"); // Montag, Dienstag, ...
}

/** Short German date label like 'Fr 25. Sep.'. */
export function shortDateDe(dt: DateTime): string {
  return dt.setZone(ZONE).setLocale("de-CH").toFormat("ccc d. LLL");
}

/** 'HH:MM' for a windowStart string like '10:00' or '10:00:00'. */
export function shortTimeLabel(s: string): string {
  const [h, m] = s.split(":");
  return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}

/** ISO YYYY-MM-DD -> DateTime at 00:00 Europe/Zurich. */
export function fromIsoDate(iso: string): DateTime {
  return DateTime.fromISO(iso, { zone: ZONE }).startOf("day");
}
