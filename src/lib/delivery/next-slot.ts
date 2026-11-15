import "server-only";
import { DateTime } from "luxon";

const ZONE = "Europe/Zurich";
const CUTOFF_HOURS = 3;
const SLOT_HOURS = [10, 16] as const;

export type NextDeliverySlot = {
  at: DateTime;
  cutoff: DateTime;
  dayLabel: string;
  timeLabel: string;
  cutoffPrefixDe: string;
  cutoffTimeLabel: string;
};

// Next bookable delivery slot in Europe/Zurich. Flat 3h cutoff for
// now; CLAUDE.md flags Tuesday as 24h — the real impl reads
// min_lead_hours per weekday from delivery_schedule. Wiring that
// through here will update PDP timeline + Konto tile in one place.
export function getNextDeliverySlot(
  reference?: DateTime,
): NextDeliverySlot | null {
  const now = (reference ?? DateTime.now()).setZone(ZONE);
  const todayStart = now.startOf("day");

  for (let d = 0; d < 14; d++) {
    const day = todayStart.plus({ days: d });
    for (const hour of SLOT_HOURS) {
      const at = day.set({ hour, minute: 0, second: 0 });
      const cutoff = at.minus({ hours: CUTOFF_HOURS });
      if (now < cutoff) {
        return {
          at,
          cutoff,
          dayLabel: dayLabelFor(at, todayStart),
          timeLabel: at.setLocale("de-CH").toFormat("HH:mm"),
          cutoffPrefixDe: cutoffPrefix(cutoff, todayStart),
          cutoffTimeLabel: cutoff.setLocale("de-CH").toFormat("HH:mm"),
        };
      }
    }
  }
  return null;
}

function dayOffset(d: DateTime, today: DateTime): number {
  return Math.round(d.startOf("day").diff(today, "days").days);
}

function dayLabelFor(d: DateTime, today: DateTime): string {
  const o = dayOffset(d, today);
  if (o === 0) return "Heute";
  if (o === 1) return "Morgen";
  if (o === 2) return "Übermorgen";
  return d.setLocale("de-CH").toFormat("cccc");
}

function cutoffPrefix(cutoff: DateTime, today: DateTime): string {
  const o = dayOffset(cutoff, today);
  if (o === 0) return "";
  if (o === 1) return "morgen ";
  return cutoff.setLocale("de-CH").toFormat("cccc").toLowerCase() + " ";
}
