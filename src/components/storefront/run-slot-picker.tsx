"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { selectRunAction } from "@/lib/checkout/actions";
import type { RunSlotDay } from "@/lib/checkout/slots";
import { CheckoutDateCalendar } from "./checkout-date-calendar";

/**
 * Datum popover + window buttons run picker.
 *
 * Compact trigger button opens the month-view calendar as a popover;
 * picking a date auto-closes. Windows appear as segmented buttons on
 * the right once a date is chosen. Selecting a window auto-submits
 * selectRunAction. Server re-validates so a stale UI is still safe.
 *
 * Outside-click and Escape close the popover.
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
  const [calendarOpen, setCalendarOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

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

  // Look up display labels by ISO date without shipping Luxon to the
  // client - server already computed weekdayLabelDe on each RunSlotDay.
  const labelForDate = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of days) m.set(d.runDate, d.weekdayLabelDe);
    return m;
  }, [days]);

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

  // Outside-click + Escape close the popover.
  useEffect(() => {
    if (!calendarOpen) return;
    function onDown(e: MouseEvent) {
      if (!popoverRef.current) return;
      if (!popoverRef.current.contains(e.target as Node)) setCalendarOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCalendarOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [calendarOpen]);

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
    setCalendarOpen(false);
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

  const datumButtonLabel = pickedDate
    ? labelForDate.get(pickedDate) ?? pickedDate
    : "Bitte Datum wählen";

  return (
    <div className="space-y-3">
      {error && (
        <p className="px-4 py-3 border border-rose/30 bg-rose/5 text-[0.85rem] text-bark">
          {error}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* -------- Datum popover -------- */}
        <div ref={popoverRef} className="relative">
          <span className="text-[0.68rem] tracking-[0.12em] uppercase font-medium text-bark block mb-1.5">
            Datum
          </span>
          <button
            type="button"
            aria-expanded={calendarOpen}
            aria-haspopup="dialog"
            onClick={() => setCalendarOpen((o) => !o)}
            className={`w-full h-[46px] px-3 border bg-ivory text-[0.9rem] text-left flex items-center justify-between transition-colors ${
              calendarOpen ? "border-bark" : "border-mist hover:border-bark"
            } ${pickedDate ? "text-bark" : "text-sage"}`}
          >
            <span className="truncate">{datumButtonLabel}</span>
            <span aria-hidden className="text-sage ml-2">▾</span>
          </button>

          {calendarOpen && (
            <div
              role="dialog"
              aria-label="Datum wählen"
              className="absolute z-30 top-full left-0 mt-2 w-[320px] max-w-[calc(100vw-2rem)] shadow-lg"
            >
              <CheckoutDateCalendar
                availableDates={availableDates}
                disabledReasons={disabledReasons}
                value={pickedDate}
                onChange={handleDatePick}
                horizonEndIso={horizonEndIso}
              />
            </div>
          )}
        </div>

        {/* -------- Zeitfenster -------- */}
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
                      className={`h-[46px] px-4 text-[0.78rem] tracking-[0.06em] font-medium border transition-colors ${
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
            <div className="h-[46px] flex items-center px-3 border border-dashed border-mist text-[0.8rem] text-sage">
              Zuerst Datum wählen.
            </div>
          )}
        </div>
      </div>

      <p className="text-[0.7rem] text-sage leading-[1.55]">
        Zwei Touren täglich mit unserem eigenen Van. Cutoff 3 Stunden vor
        Beginn der Tour (Dienstag 24 Stunden). Fahren Sie mit dem Cursor
        über einen gesperrten Tag im Kalender, um den Grund zu sehen.
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
