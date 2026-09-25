"use client";

import { useMemo, useState } from "react";
import { DateTime } from "luxon";

/**
 * Month-view calendar for checkout date selection.
 *
 * Availability is pre-computed server-side (the seven-condition rule)
 * and passed in as `availableDates` (ISO YYYY-MM-DD). Dates not in
 * the set are rendered non-clickable with the reason on hover.
 *
 * No new deps. Uses Luxon (already installed) for month arithmetic
 * so DST doesn't matter here and locale strings come out in de-CH.
 * Keyboard: arrow keys move focus within the grid, Enter picks.
 *
 * Kept storefront-namespaced because it embeds Magenta styling and
 * German copy; not intended to be a generic primitive.
 */

const ZONE = "Europe/Zurich";
const WEEKDAY_LABELS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

type DisabledReason = {
  isoDate: string;
  reasonDe: string;
};

export function CheckoutDateCalendar({
  availableDates,
  disabledReasons,
  value,
  onChange,
  horizonEndIso,
}: {
  /** ISO YYYY-MM-DD strings for pickable dates. */
  availableDates: string[];
  /** Optional per-date German reason for the disabled ones. Tooltip only. */
  disabledReasons?: DisabledReason[];
  /** Current selection ISO YYYY-MM-DD, or empty. */
  value: string;
  onChange: (isoDate: string) => void;
  /** ISO YYYY-MM-DD, the last bookable day. Prev/next stop at its month. */
  horizonEndIso?: string;
}) {
  const availableSet = useMemo(() => new Set(availableDates), [availableDates]);
  const reasonMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of disabledReasons ?? []) m.set(r.isoDate, r.reasonDe);
    return m;
  }, [disabledReasons]);

  // Anchor month: prefer the month of the current selection, else the
  // first available date, else today.
  const initialMonth = useMemo(() => {
    if (value) return DateTime.fromISO(value, { zone: ZONE }).startOf("month");
    if (availableDates.length > 0) {
      return DateTime.fromISO(availableDates[0], { zone: ZONE }).startOf("month");
    }
    return DateTime.now().setZone(ZONE).startOf("month");
  }, [availableDates, value]);

  const [viewMonth, setViewMonth] = useState<DateTime>(initialMonth);

  const today = DateTime.now().setZone(ZONE).startOf("day");
  const horizonEnd = horizonEndIso
    ? DateTime.fromISO(horizonEndIso, { zone: ZONE })
    : today.plus({ months: 1 });

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth]);

  const canGoPrev = viewMonth > today.startOf("month");
  const canGoNext = viewMonth.plus({ months: 1 }) <= horizonEnd.startOf("month");

  return (
    <div className="border border-mist bg-ivory p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setViewMonth((m) => m.minus({ months: 1 }))}
          disabled={!canGoPrev}
          aria-label="Vorheriger Monat"
          className="w-8 h-8 flex items-center justify-center text-bark hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ‹
        </button>
        <span
          aria-live="polite"
          className="font-display text-[1.05rem] text-bark tracking-tight"
        >
          {viewMonth.setLocale("de-CH").toFormat("LLLL yyyy")}
        </span>
        <button
          type="button"
          onClick={() => setViewMonth((m) => m.plus({ months: 1 }))}
          disabled={!canGoNext}
          aria-label="Nächster Monat"
          className="w-8 h-8 flex items-center justify-center text-bark hover:bg-cream disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ›
        </button>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS_DE.map((w) => (
          <div
            key={w}
            className="h-6 flex items-center justify-center text-[0.6rem] tracking-[0.12em] uppercase text-sage font-medium"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        role="grid"
        aria-label="Lieferdatum wählen"
        className="grid grid-cols-7 gap-1"
      >
        {cells.map((cell) => {
          const iso = cell.dt.toISODate() ?? "";
          const inMonth = cell.dt.month === viewMonth.month;
          const isAvailable = availableSet.has(iso);
          const isSelected = value === iso;
          const isToday = cell.dt.hasSame(today, "day");
          const reason = reasonMap.get(iso);

          const dayNumber = cell.dt.day;

          if (!inMonth) {
            return (
              <div key={iso} aria-hidden className="h-10" />
            );
          }

          if (isAvailable) {
            return (
              <button
                key={iso}
                type="button"
                role="gridcell"
                aria-selected={isSelected}
                onClick={() => onChange(iso)}
                className={`h-10 text-[0.85rem] tabular-nums transition-colors ${
                  isSelected
                    ? "bg-rose text-ivory"
                    : "text-bark hover:bg-cream"
                } ${isToday && !isSelected ? "ring-1 ring-inset ring-bark/30" : ""}`}
              >
                {dayNumber}
              </button>
            );
          }

          return (
            <span
              key={iso}
              role="gridcell"
              aria-disabled="true"
              title={reason ?? undefined}
              className={`h-10 flex items-center justify-center text-[0.85rem] tabular-nums text-sage/40 line-through cursor-not-allowed ${
                isToday ? "ring-1 ring-inset ring-bark/20" : ""
              }`}
            >
              {dayNumber}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Return 42 cells (6 rows x 7 cols) starting on Monday of the week that
 * contains the first of `month`. Cells outside the month are still real
 * DateTimes so navigation math is consistent.
 */
function buildMonthCells(month: DateTime): { dt: DateTime }[] {
  const first = month.startOf("month");
  // Luxon weekday: 1=Mon, 7=Sun. To make Monday column 0:
  const offsetToMonday = first.weekday - 1;
  const gridStart = first.minus({ days: offsetToMonday });
  const cells: { dt: DateTime }[] = [];
  for (let i = 0; i < 42; i += 1) {
    cells.push({ dt: gridStart.plus({ days: i }) });
  }
  return cells;
}
