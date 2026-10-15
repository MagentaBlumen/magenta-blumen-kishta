"use client";

import { useTransition } from "react";
import { moveRouteStopAction } from "@/app/(admin)/admin/bestellung/[number]/actions";

/**
 * Tiny up/down buttons under the route-stop number on each Heute row.
 * stopPropagation on both so clicking a button doesn't trigger the
 * parent <Link> navigation to the detail page.
 *
 * Only rendered for `run` orders - timed/pickup/post have no route to
 * reorder. Rendering decision is in the caller (Heute page).
 */
export function RouteStopButtons({ orderNumber }: { orderNumber: string }) {
  const [isPending, startTransition] = useTransition();

  function move(e: React.MouseEvent, direction: "up" | "down") {
    e.preventDefault();
    e.stopPropagation();
    if (isPending) return;
    startTransition(async () => {
      try {
        await moveRouteStopAction(orderNumber, direction);
      } catch {
        // Silent fail. The reorder is low-stakes and the user will
        // notice the row didn't move; details go to server logs.
      }
    });
  }

  const base =
    "inline-flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded transition-colors disabled:opacity-40";

  return (
    <div
      className="mt-0.5 flex flex-col items-center"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Stop nach oben"
        onClick={(e) => move(e, "up")}
        disabled={isPending}
        className={base}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Stop nach unten"
        onClick={(e) => move(e, "down")}
        disabled={isPending}
        className={base}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}
