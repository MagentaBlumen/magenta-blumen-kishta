"use client";

import { useState, useTransition } from "react";
import { selectRunAction } from "@/lib/checkout/actions";
import type { RunSlotDay, RunSlotView } from "@/lib/checkout/slots";

/**
 * Two-window-per-day run picker. Days that are entirely unavailable
 * are already filtered out server-side; a day with one open and one
 * disabled window is shown with the closed one greyed.
 *
 * Every disabled window carries a German reason string (per the doc's
 * conversion-killer rule: no unexplained greys).
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

  function pickRun(runId: number) {
    setError(null);
    startTransition(async () => {
      try {
        await selectRunAction(runId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  if (days.length === 0) {
    return (
      <div className="p-6 border border-mist text-[0.85rem] text-sage">
        Zurzeit sind keine Termine verfügbar. Bitte kontaktieren Sie uns
        direkt: 056 556 56 09.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="px-4 py-3 border border-rose/30 bg-rose/5 text-[0.85rem] text-bark">
          {error}
        </p>
      )}
      <ul className="border-t border-mist max-h-[520px] overflow-y-auto">
        {days.map((d) => (
          <li
            key={d.runDate}
            className="grid grid-cols-[110px_1fr] gap-4 py-3 border-b border-mist items-center"
          >
            <span className="text-[0.85rem] text-bark tabular-nums">
              {d.weekdayLabelDe}
            </span>
            <div className="flex gap-2 flex-wrap">
              {d.slots.map((s) => (
                <SlotButton
                  key={s.runId}
                  slot={s}
                  isSelected={s.runId === selectedRunId}
                  isPending={isPending}
                  onClick={() => pickRun(s.runId)}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[0.7rem] text-sage leading-[1.55]">
        Zwei Touren täglich mit unserem eigenen Van. Cutoff 3 Stunden vor
        Beginn der Tour (Dienstag 24 Stunden).
      </p>
    </div>
  );
}

function SlotButton({
  slot,
  isSelected,
  isPending,
  onClick,
}: {
  slot: RunSlotView;
  isSelected: boolean;
  isPending: boolean;
  onClick: () => void;
}) {
  if (slot.status.kind === "disabled") {
    return (
      <span
        title={slot.status.reasonDe}
        className="inline-flex items-center gap-2 px-3 py-2 border border-mist bg-mist/40 text-[0.72rem] text-sage line-through cursor-not-allowed"
      >
        {slot.windowLabelDe}
        <span className="not-italic no-underline text-[0.66rem] tracking-normal">
          . {slot.status.reasonDe}
        </span>
      </span>
    );
  }
  return (
    <button
      type="button"
      disabled={isPending}
      onClick={onClick}
      aria-pressed={isSelected}
      className={`px-3 py-2 text-[0.72rem] tracking-[0.08em] uppercase font-medium border transition-colors ${
        isSelected
          ? "border-rose bg-rose text-ivory"
          : "border-mist text-bark hover:border-bark hover:bg-cream"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {slot.windowLabelDe}
    </button>
  );
}
