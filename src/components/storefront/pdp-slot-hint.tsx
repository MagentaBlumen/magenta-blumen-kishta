import { DateTime } from "luxon";

const ZONE = "Europe/Zurich";
// Cutoff: slots close N hours before the window starts. Matches the
// per-weekday default; genuine lock + capacity check happens later at
// /kasse/lieferung under FOR UPDATE.
const CUTOFF_HOURS = 3;
const SLOT_HOURS = [10, 16] as const;

type Slot = {
  dayLabel: "Heute" | "Morgen" | "Übermorgen" | string;
  time: string;
  cutoffNote: string;
};

/**
 * Compute the next N upcoming delivery-slot hints relative to NOW in
 * Europe/Zurich. Purely informational — this component does NOT reserve
 * capacity, does NOT read delivery_run, and does NOT respect blackout
 * dates or weekly_schedule overrides. All of those are checked under
 * FOR UPDATE at reserve time per docs/checkout-transaction.md.
 */
function nextSlots(now: DateTime, count = 3): Slot[] {
  const out: Slot[] = [];
  const probe = now.startOf("day");
  // Walk day-by-day for up to 7 days collecting slots that are still
  // beyond the cutoff.
  for (let dayOffset = 0; dayOffset < 7 && out.length < count; dayOffset++) {
    const day = probe.plus({ days: dayOffset });
    for (const hour of SLOT_HOURS) {
      const windowStart = day.set({ hour, minute: 0, second: 0 });
      const cutoff = windowStart.minus({ hours: CUTOFF_HOURS });
      if (cutoff <= now) continue;
      const dayLabel =
        dayOffset === 0
          ? "Heute"
          : dayOffset === 1
            ? "Morgen"
            : dayOffset === 2
              ? "Übermorgen"
              : day.setLocale("de-CH").toFormat("ccc d. LLL");
      const cutoffNote =
        dayOffset === 0 && cutoff.diff(now, "minutes").minutes < 60
          ? `Bestellen bis ${cutoff.setLocale("de-CH").toFormat("HH:mm")} Uhr`
          : `Bestellen bis ${cutoff.setLocale("de-CH").toFormat(dayOffset > 0 ? "HH:mm" : "HH:mm")} Uhr`;
      out.push({
        dayLabel,
        time: windowStart.setLocale("de-CH").toFormat("HH:mm"),
        cutoffNote,
      });
      if (out.length >= count) break;
    }
  }
  return out;
}

/**
 * Informational "when can I get this?" preview on the PDP. Shows the
 * next three real delivery slots with cutoff hints. Explicitly NOT a
 * slot picker — selection happens at /kasse/lieferung where capacity
 * can actually be locked.
 */
export function PdpSlotHint() {
  const now = DateTime.now().setZone(ZONE);
  const slots = nextSlots(now, 3);
  if (slots.length === 0) return null;

  const firstCutoff = slots[0].cutoffNote;

  return (
    <div className="rounded-md border border-mist bg-ivory p-5 flex flex-col gap-3.5">
      <p className="m-0 text-[14px] font-semibold text-bark">
        Nächste Liefertermine
      </p>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((s, i) => (
          <div
            key={`${s.dayLabel}-${s.time}-${i}`}
            className="min-h-[64px] px-2 py-2 rounded border border-bark/20 bg-cream/60 flex flex-col items-center justify-center gap-0.5 text-center"
          >
            <span className="text-[13px] text-sage">{s.dayLabel}</span>
            <span className="font-display text-[1.35rem] text-bark leading-[1.1]">
              {s.time}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-sage">
        <span className="inline-flex items-center gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {firstCutoff}
        </span>
        <span className="text-bark/60">
          Zeitpunkt wählen Sie im nächsten Schritt.
        </span>
      </div>
    </div>
  );
}
