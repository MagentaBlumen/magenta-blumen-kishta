"use client";

import { useMemo, useState, useTransition } from "react";
import { selectRunAction } from "@/lib/checkout/actions";
import type { RunSlotDay } from "@/lib/checkout/slots";
import { CheckoutDateCalendar } from "./checkout-date-calendar";

/**
 * Calendar + window buttons run picker.
 *
 * Left column: month-view calendar. Only dates with >=1 available
 * window are clickable; the rest are greyed with the German reason
 * as tooltip. Right column: two segmented buttons for the day's
 * windows (Vormittag / Nachmittag) - up to two, so buttons look
 * better than a dropdown.
 *
 * Selecting a window auto-submits selectRunAction. Server re-validates
 * so a stale UI is still safe.
 */
export function RunSlotPicker({
  days,
  selectedRunId,
}: {
  days: RunSlotDay[];
  selectedRunId: number | undefined;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Server dropped days with permanently-disabled slots already, but
  // we still want to keep cutoff/capacity/lead-time disabled rows so
  // the customer sees WHY their preferred date isn't clickable.
  const availableDates = useMemo(
    () =>
      days
        .filter((d) => d.slots.some((s) => s.status.kind === "available"))
        .map((d) => d.runDate),
    [days],
  );

  const disabledReasons = useMemo(() => {
    // One reason per disabled date, taking the first disabled slot's
    // reason. If both windows are disabled, blackout/cutoff/capacity
    // usually apply to both anyway; when they differ the tooltip is
    // a hint, not a spec.
    const availableSet = new Set(availableDates);
    const rows: { isoDate: string; reasonDe: string }[] = [];
    for (const d of days) {
      if (availableSet.has(d.runDate)) continue;
      const firstDisabled = d.slots.find((s) => s.status.kind === "disabled");
      if (firstDisabled && firstDisabled.status.kind === "disabled") {
        rows.push({ isoDate: d.runDate, reasonDe: firstDisabled.status.reasonDe });
      } else {
        rows.push({ isoDate: d.runDate, reasonDe: "Nicht verfügbar" });
      }
    }
    return rows;
  }, [availableDates, days]);

  // Seed state from the cookie's current selection. Only used on the
  // first render (useState initialiser), so a lazy call - not a memo -
  // is the right tool. Using useMemo here made the React Compiler
  // refuse to optimise the component (preserve-manual-memoization).
  const [pickedDate, setPickedDate] = useState<string>(() =>
    findInitialDate(days, selectedRunId),
  );
  const [pickedRunId, setPickedRunId] = useState<number | undefined>(
    () => selectedRunId,
  );

  const windowsForDate = useMemo(() => {
    if (!pickedDate) return [];
    const day = days.find((d) => d.runDate === pickedDate);
    if (!day) return [];
    return day.slots.filter((s) => s.status.kind === "available");
  }, [days, pickedDate]);

  const horizonEndIso = days[days.length - 1]?.runDate;

  if (availableDates.length === 0) {
    return (
      <div className="p-6 border border-mist text-[0.85rem] text-sage">
        Zurzeit sind keine Termine verfügbar. Bitte kontaktieren Sie uns
        direkt: 056 556 56 09.
      </div>
    );
  }

  function handleDatePick(iso: string) {
    setPickedDate(iso);
    setPickedRunId(undefined);
    setError(null);
  }

  function handleWindowPick(runId: number) {
    setPickedRunId(runId);
    setError(null);
    startTransition(async () => {
      try {
        await selectRunAction(runId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="px-4 py-3 border border-rose/30 bg-rose/5 text-[0.85rem] text-bark">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
        <div>
          <span className="text-[0.68rem] tracking-[0.12em] uppercase font-medium text-bark block mb-1.5">
            Datum
          </span>
          <CheckoutDateCalendar
            availableDates={availableDates}
            disabledReasons={disabledReasons}
            value={pickedDate}
            onChange={handleDatePick}
            horizonEndIso={horizonEndIso}
          />
        </div>

        <div>
          <span className="text-[0.68rem] tracking-[0.12em] uppercase font-medium text-bark block mb-1.5">
            Zeitfenster
          </span>
          {pickedDate ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {windowsForDate.length === 0 ? (
                <div className="col-span-2 p-3 border border-mist bg-cream text-[0.8rem] text-sage">
                  Für dieses Datum sind keine Fenster verfügbar.
                </div>
              ) : (
                windowsForDate.map((s) => {
                  const isSelected = s.runId === pickedRunId;
                  return (
                    <button
                      key={s.runId}
                      type="button"
                      onClick={() => handleWindowPick(s.runId)}
                      disabled={isPending}
                      aria-pressed={isSelected}
                      className={`px-4 py-3 text-[0.78rem] tracking-[0.06em] font-medium border transition-colors ${
                        isSelected
                          ? "border-rose bg-rose text-ivory"
                          : "border-mist text-bark hover:border-bark hover:bg-cream"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {s.windowLabelDe}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="p-3 border border-dashed border-mist text-[0.8rem] text-sage">
              Wählen Sie zuerst ein Datum.
            </div>
          )}
        </div>
      </div>

      <p className="text-[0.7rem] text-sage leading-[1.55]">
        Zwei Touren täglich mit unserem eigenen Van. Cutoff 3 Stunden vor
        Beginn der Tour (Dienstag 24 Stunden). Fahren Sie mit dem Cursor
        über einen gesperrten Tag, um den Grund zu sehen.
      </p>
    </div>
  );
}

function findInitialDate(
  days: RunSlotDay[],
  selectedRunId: number | undefined,
): string {
  if (selectedRunId === undefined) return "";
  for (const d of days) {
    for (const s of d.slots) {
      if (s.runId === selectedRunId) return d.runDate;
    }
  }
  return "";
}
