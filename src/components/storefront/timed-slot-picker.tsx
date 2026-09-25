"use client";

import { useMemo, useState, useTransition } from "react";
import { selectTimedAction } from "@/lib/checkout/actions";
import type { TimedSlotDay } from "@/lib/checkout/slots";

/**
 * Date-then-hour timed picker for funerals / weddings / events.
 * Ceremony time - she delivers ca. an hour before.
 *
 * Two-step interaction:
 *   1. Pick a date from a horizontal chip list.
 *   2. Pick an hour from the day's grid.
 *
 * Cap of 3 per hour surfaces as "Ausgebucht" on the offending hour.
 */
export function TimedSlotPicker({
  days,
  selectedIso,
}: {
  days: TimedSlotDay[];
  selectedIso: string | undefined;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Which date is highlighted in the day chips. Default to the day
  // that contains the currently-selected hour (on reload), else the
  // first available date.
  const initialDate = useMemo(() => {
    if (selectedIso) {
      const dayMatch = days.find((d) =>
        d.hours.some((h) => h.isoStart === selectedIso),
      );
      if (dayMatch) return dayMatch.runDate;
    }
    return days[0]?.runDate ?? "";
  }, [days, selectedIso]);
  const [activeDate, setActiveDate] = useState(initialDate);

  const activeDay = days.find((d) => d.runDate === activeDate) ?? days[0];

  function pickHour(iso: string) {
    setError(null);
    startTransition(async () => {
      try {
        await selectTimedAction(iso);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  if (days.length === 0) {
    return (
      <div className="p-6 border border-mist text-[0.85rem] text-sage">
        Zurzeit sind keine Zeitpunkte verfügbar. Bitte kontaktieren Sie uns
        direkt: 056 556 56 09.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="px-4 py-3 border border-rose/30 bg-rose/5 text-[0.85rem] text-bark">
          {error}
        </p>
      )}

      {/* Day chips */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => (
          <button
            key={d.runDate}
            type="button"
            onClick={() => setActiveDate(d.runDate)}
            className={`flex-shrink-0 px-4 py-2 text-[0.75rem] border transition-colors ${
              d.runDate === activeDate
                ? "border-bark bg-bark text-ivory"
                : "border-mist text-bark hover:border-bark"
            }`}
          >
            {d.weekdayLabelDe}
          </button>
        ))}
      </div>

      {/* Hour grid for the active day */}
      {activeDay && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {activeDay.hours.map((h) => {
            if (h.status.kind === "disabled") {
              return (
                <span
                  key={h.isoStart}
                  title={h.status.reasonDe}
                  className="px-3 py-2 text-center text-[0.75rem] border border-mist bg-mist/40 text-sage line-through cursor-not-allowed"
                >
                  {h.hourLabelDe}
                </span>
              );
            }
            const isSelected = h.isoStart === selectedIso;
            return (
              <button
                key={h.isoStart}
                type="button"
                disabled={isPending}
                onClick={() => pickHour(h.isoStart)}
                aria-pressed={isSelected}
                className={`px-3 py-2 text-center text-[0.75rem] font-medium border transition-colors ${
                  isSelected
                    ? "border-rose bg-rose text-ivory"
                    : "border-mist text-bark hover:border-bark hover:bg-cream"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {h.hourLabelDe}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[0.7rem] text-sage leading-[1.55]">
        Bis 3 Trauer- oder Event-Lieferungen pro Stunde. Wir liefern ca.
        eine Stunde vor der genannten Zeit.
      </p>
    </div>
  );
}
