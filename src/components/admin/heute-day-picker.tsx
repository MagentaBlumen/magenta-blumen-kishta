"use client";

import { useRouter } from "next/navigation";

export type DayTab = {
  iso: string;
  label: string;
  count: number;
};

// Segmented day picker for the Heute page. Each tab navigates to
// `/admin?tag=<iso>` so the selection survives reloads + back-forward.
// The current day is driven by searchParams on the server.
export function HeuteDayPicker({
  days,
  currentIso,
}: {
  days: DayTab[];
  currentIso: string;
}) {
  const router = useRouter();

  if (days.length === 0) return null;

  return (
    <div className="seg" role="group" aria-label="Tag wählen">
      {days.map((d) => {
        const isActive = d.iso === currentIso;
        return (
          <button
            key={d.iso}
            type="button"
            aria-pressed={isActive}
            onClick={() => router.push(`/admin?tag=${d.iso}`, { scroll: false })}
          >
            {d.label} <span>{d.count}</span>
          </button>
        );
      })}
    </div>
  );
}
