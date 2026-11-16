"use client";

import { useTransition } from "react";
import { setOrderStageAction } from "@/app/(admin)/admin/bestellung/[number]/actions";
import type { OrderStatus } from "@/lib/admin/order-status";

// Dropdown that shows the order's current 4-stage UI status and lets
// the admin jump to any later stage in one action. Server walks the
// DB pipeline on their behalf — no more clicking through confirmed →
// in_production → ready manually. Also offers 'Storniert' as the
// escape hatch.
export function StatusSelect({
  orderNumber,
  status,
}: {
  orderNumber: string;
  status: OrderStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const currentStage = uiStageFor(status);

  function change(nextStage: string) {
    if (nextStage === currentStage) return;
    startTransition(async () => {
      try {
        await setOrderStageAction(orderNumber, nextStage);
      } catch (err) {
        console.error("stage change failed:", err);
      }
    });
  }

  // Terminal states have no outgoing transitions; keep the dropdown
  // present but disabled so admin still sees the value.
  const isTerminal =
    status === "delivered" ||
    status === "cancelled" ||
    status === "delivery_failed";

  return (
    <select
      aria-label={`Status Bestellung ${orderNumber}`}
      value={currentStage}
      disabled={isPending || isTerminal}
      onChange={(e) => change(e.target.value)}
      // Matches the mockup's `.order__next` chrome: rose pill with
      // white text, 48px tall. Native select for mobile reliability.
      className="h-12 px-4 pr-9 bg-rose text-ivory text-[15px] font-semibold border-0 cursor-pointer appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        backgroundImage:
          'url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2.4\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")',
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
      }}
    >
      <option value="neu">Neu</option>
      <option value="fertig">Fertig</option>
      <option value="unterwegs">Unterwegs</option>
      <option value="geliefert">Geliefert</option>
      <option value="storniert">Storniert</option>
    </select>
  );
}

function uiStageFor(s: OrderStatus): "neu" | "fertig" | "unterwegs" | "geliefert" | "storniert" {
  switch (s) {
    case "new":
    case "confirmed":
      return "neu";
    case "in_production":
    case "ready":
      return "fertig";
    case "out_for_delivery":
    case "delivery_failed":
      return "unterwegs";
    case "delivered":
      return "geliefert";
    case "cancelled":
      return "storniert";
  }
}

// Print trigger (unchanged).
export function PrintButton() {
  return (
    <button
      type="button"
      className="btn btn--lg"
      onClick={() => window.print()}
    >
      <svg
        className="icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9V3h12v6" />
        <rect x="3" y="9" width="18" height="8" />
        <path d="M6 14h12v7H6z" />
      </svg>
      Drucken
    </button>
  );
}
