"use client";

import { useTransition } from "react";
import { updateOrderStatusAction } from "@/app/(admin)/admin/bestellung/[number]/actions";
import type { OrderStatus } from "@/lib/admin/order-status";

// Primary "next step" button that moves the order one stop forward
// in the state machine. Label comes from the caller so the Heute
// page can show the mockup wording ('Strauss ist fertig', etc.)
// while the action still runs through the strict DB transitions.
export function NextStepButton({
  orderNumber,
  target,
  label,
}: {
  orderNumber: string;
  target: OrderStatus;
  label: string;
}) {
  const [isPending, startTransition] = useTransition();
  function run() {
    startTransition(async () => {
      try {
        await updateOrderStatusAction(orderNumber, target);
      } catch (err) {
        // Silent in-place fail — admin sees no visual update and will
        // try again. Fine for now; a toast system would upgrade this.
        console.error("status transition failed:", err);
      }
    });
  }
  return (
    <button
      type="button"
      className="order__next"
      onClick={run}
      disabled={isPending}
    >
      <svg
        className="icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M5 12l5 5 9-10" />
      </svg>
      {isPending ? "…" : label}
    </button>
  );
}

// "Rückgängig" link — bumps the order back one state. Only renders when
// the caller supplies a `previous` target (i.e. the transition is in
// the allowed list).
export function UndoStepButton({
  orderNumber,
  previous,
}: {
  orderNumber: string;
  previous: OrderStatus;
}) {
  const [isPending, startTransition] = useTransition();
  function run() {
    startTransition(async () => {
      try {
        await updateOrderStatusAction(orderNumber, previous);
      } catch (err) {
        console.error("status undo failed:", err);
      }
    });
  }
  return (
    <button
      type="button"
      className="btn-link"
      onClick={run}
      disabled={isPending}
    >
      Rückgängig
    </button>
  );
}

// Print trigger that opens the browser print dialog. Admin CSS @media
// print strips the sidebar + action buttons so the paper view shows
// the day list cleanly.
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
