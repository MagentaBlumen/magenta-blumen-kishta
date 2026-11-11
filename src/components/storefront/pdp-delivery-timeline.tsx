import { DateTime } from "luxon";

const ZONE = "Europe/Zurich";
const CUTOFF_HOURS = 3;
const SLOT_HOURS = [10, 16] as const;

type Slot = {
  dayLabel: string;
  time: string;
  note: string;
  state: "past" | "next" | "future";
};

/**
 * Horizontal 4-stop timeline of upcoming (and the just-missed) delivery
 * slots. Shows the closest past slot from today greyed out so the
 * customer feels where "now" is, plus the next 3 bookable slots.
 *
 * Purely informational — selection happens at /kasse/lieferung under
 * FOR UPDATE where capacity can actually be locked.
 */
export function PdpDeliveryTimeline() {
  const now = DateTime.now().setZone(ZONE);
  const todayStart = now.startOf("day");

  type Raw = {
    at: DateTime;
    cutoff: DateTime;
  };
  const raw: Raw[] = [];
  for (let d = 0; d < 5; d++) {
    const day = todayStart.plus({ days: d });
    for (const hour of SLOT_HOURS) {
      const at = day.set({ hour, minute: 0, second: 0 });
      raw.push({ at, cutoff: at.minus({ hours: CUTOFF_HOURS }) });
    }
  }

  // Find the index of the FIRST slot whose cutoff is still in the
  // future (the next bookable one).
  const firstBookable = raw.findIndex((t) => now < t.cutoff);
  const nextIdx = firstBookable >= 0 ? firstBookable : raw.length;

  // Include one past slot from today (if there is one) so the customer
  // sees where today sits on the timeline. Otherwise just the next 4.
  let startIdx = nextIdx;
  if (
    nextIdx > 0 &&
    dayOffset(raw[nextIdx - 1].at, todayStart) === 0
  ) {
    startIdx = nextIdx - 1;
  }

  const window = raw.slice(startIdx, startIdx + 4);

  const slots: Slot[] = window.map((t) => {
    const isPast = now >= t.cutoff;
    const isNext = t === raw[nextIdx];
    return {
      dayLabel: labelFor(t.at, todayStart),
      time: t.at.setLocale("de-CH").toFormat("HH:mm"),
      note: isPast
        ? "Bestellschluss vorbei"
        : isNext
          ? "Frühester Termin"
          : `bis ${t.cutoff.setLocale("de-CH").toFormat("HH:mm")} bestellen`,
      state: isPast ? "past" : isNext ? "next" : "future",
    };
  });

  if (slots.length === 0) return null;

  return (
    <div className="bg-cream p-5 flex flex-col gap-4">
      <span className="inline-flex items-center gap-2.5 text-[12px] font-semibold tracking-[0.14em] uppercase text-sage">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-rose"
          aria-hidden
        >
          <path d="M2 7h11v9H2z" />
          <path d="M13 10h4l3 3v3h-7z" />
          <circle cx="6" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
        So früh kann es da sein
      </span>

      <ol
        aria-label="Nächste Liefertouren"
        className="relative grid grid-cols-2 sm:grid-cols-4 gap-y-5 sm:gap-y-0 m-0 p-0 list-none"
      >
        {/* Connecting line behind the dots on >= sm */}
        <span
          aria-hidden
          className="hidden sm:block absolute left-[6px] right-[6px] top-[6px] h-[2px] bg-[#B8916A]"
        />
        {slots.map((s, i) => (
          <li
            key={`${s.dayLabel}-${s.time}-${i}`}
            className={`relative flex flex-col gap-1.5 pr-2 ${
              s.state === "past" ? "opacity-40" : ""
            }`}
          >
            <span
              aria-hidden
              className={`inline-block w-3.5 h-3.5 rounded-full border-2 ${
                s.state === "next"
                  ? "bg-rose border-rose shadow-[0_0_0_5px_rgba(163,22,95,0.15)]"
                  : "bg-cream border-bark"
              }`}
            />
            <span
              className={`text-[14px] ${s.state === "next" ? "font-semibold text-bark" : "text-bark"}`}
            >
              {s.dayLabel} {s.time}
            </span>
            <span
              className={`text-[12px] ${
                s.state === "next" ? "text-rose font-semibold" : "text-sage"
              }`}
            >
              {s.note}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function dayOffset(d: DateTime, today: DateTime): number {
  return Math.round(d.startOf("day").diff(today, "days").days);
}

function labelFor(d: DateTime, today: DateTime): string {
  const offset = dayOffset(d, today);
  if (offset === 0) return "Heute";
  if (offset === 1) return "Morgen";
  if (offset === 2) return "Übermorgen";
  return d.setLocale("de-CH").toFormat("ccc");
}
