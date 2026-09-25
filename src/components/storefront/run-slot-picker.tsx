"use client";

import { useMemo, useState, useTransition } from "react";
import { selectRunAction } from "@/lib/checkout/actions";
import type { RunSlotDay } from "@/lib/checkout/slots";

/**
 * Two-dropdown run picker: Datum then Zeitfenster.
 *
 * Only dates that have at least one AVAILABLE window appear in the
 * first dropdown. When a date is chosen, the second dropdown lists
 * only that day's available windows. Selecting a window auto-submits
 * (calls selectRunAction) - the server re-validates so the round-trip
 * is safe against a stale UI.
 *
 * A collapsed "Warum sind manche Tage nicht wählbar?" block lists the
 * days the classifier ruled out and their German reason, so the "no
 * unexplained greys" rule from the doc is preserved without the wall
 * of chips.
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

  // Split available vs unavailable so the dropdown only offers real
  // choices, and the "why not" block can explain the rest.
  const availableDays = useMemo(
    () =>
      days
        .map((d) => ({
          ...d,
          slots: d.slots.filter((s) => s.status.kind === "available"),
        }))
        .filter((d) => d.slots.length > 0),
    [days],
  );

  const unavailableEntries = useMemo(() => {
    const rows: { dateLabel: string; window: string; reason: string }[] = [];
    for (const d of days) {
      for (const s of d.slots) {
        if (s.status.kind === "disabled") {
          rows.push({
            dateLabel: d.weekdayLabelDe,
            window: s.windowLabelDe,
            reason: s.status.reasonDe,
          });
        }
      }
    }
    return rows;
  }, [days]);

  // Initialise local selection state from the runId already in the
  // cookie (server prop). Falls back to nothing.
  const initial = useMemo(() => {
    if (selectedRunId === undefined) return { date: "", runId: undefined };
    for (const d of availableDays) {
      for (const s of d.slots) {
        if (s.runId === selectedRunId) {
          return { date: d.runDate, runId: s.runId };
        }
      }
    }
    return { date: "", runId: undefined };
  }, [availableDays, selectedRunId]);

  const [pickedDate, setPickedDate] = useState<string>(initial.date);
  const [pickedRunId, setPickedRunId] = useState<number | undefined>(initial.runId);

  const windowsForDate = useMemo(() => {
    if (!pickedDate) return [];
    return availableDays.find((d) => d.runDate === pickedDate)?.slots ?? [];
  }, [availableDays, pickedDate]);

  if (availableDays.length === 0) {
    return (
      <div className="p-6 border border-mist text-[0.85rem] text-sage">
        Zurzeit sind keine Termine verfügbar. Bitte kontaktieren Sie uns
        direkt: 056 556 56 09.
      </div>
    );
  }

  function handleDateChange(next: string) {
    setPickedDate(next);
    setPickedRunId(undefined); // reset window whenever date changes
    setError(null);
  }

  function handleWindowChange(nextRunIdStr: string) {
    const runId = Number(nextRunIdStr);
    if (!Number.isInteger(runId) || runId <= 0) return;
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

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-[0.68rem] tracking-[0.12em] uppercase font-medium text-bark block mb-1.5">
            Datum
          </span>
          <select
            value={pickedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            disabled={isPending}
            className="w-full h-[46px] px-3 border border-mist bg-ivory text-bark text-[0.9rem] focus:outline-none focus:border-bark disabled:opacity-50"
          >
            <option value="">Bitte wählen</option>
            {availableDays.map((d) => (
              <option key={d.runDate} value={d.runDate}>
                {d.weekdayLabelDe}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-[0.68rem] tracking-[0.12em] uppercase font-medium text-bark block mb-1.5">
            Zeitfenster
          </span>
          <select
            value={pickedRunId ?? ""}
            onChange={(e) => handleWindowChange(e.target.value)}
            disabled={isPending || !pickedDate}
            className="w-full h-[46px] px-3 border border-mist bg-ivory text-bark text-[0.9rem] focus:outline-none focus:border-bark disabled:opacity-50"
          >
            <option value="">{pickedDate ? "Bitte wählen" : "Zuerst Datum wählen"}</option>
            {windowsForDate.map((s) => (
              <option key={s.runId} value={s.runId}>
                {s.windowLabelDe}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-[0.7rem] text-sage leading-[1.55]">
        Zwei Touren täglich mit unserem eigenen Van. Cutoff 3 Stunden vor
        Beginn der Tour (Dienstag 24 Stunden).
      </p>

      {unavailableEntries.length > 0 && (
        <details className="text-[0.78rem] text-sage">
          <summary className="cursor-pointer hover:text-bark">
            Warum sind manche Tage nicht wählbar?
          </summary>
          <ul className="mt-2 space-y-1 pl-4 max-h-56 overflow-y-auto">
            {unavailableEntries.map((r, i) => (
              <li key={i} className="grid grid-cols-[110px_1fr_auto] gap-3 py-0.5">
                <span className="tabular-nums text-bark">{r.dateLabel}</span>
                <span className="text-sage">{r.window}</span>
                <span className="text-sage text-right">{r.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
