"use client";

import { useTransition } from "react";
import { selectFulfilmentAction } from "@/lib/checkout/actions";

/**
 * Radio pair: van delivery vs timed (funeral / wedding / event).
 * Pickup is an intentional future addition - the user's plan for 5d
 * focuses on run + timed, both of which need capacity guarantees;
 * pickup has neither and can land later.
 */
export function FulfilmentPicker({
  value,
}: {
  value: "run" | "timed" | undefined;
}) {
  const [isPending, startTransition] = useTransition();

  function pick(kind: "run" | "timed") {
    if (value === kind || isPending) return;
    startTransition(async () => {
      await selectFulfilmentAction(kind);
    });
  }

  return (
    <section className="space-y-3">
      <p className="text-[0.68rem] tracking-[0.16em] uppercase text-bark font-medium">
        Liefermethode
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <FulfilmentButton
          isSelected={value === "run"}
          isPending={isPending}
          onClick={() => pick("run")}
          title="Standardlieferung"
          body="Zwei Zeitfenster täglich: 10.12 oder 16.18 Uhr. Auch am Sonntag."
        />
        <FulfilmentButton
          isSelected={value === "timed"}
          isPending={isPending}
          onClick={() => pick("timed")}
          title="Trauer- / Event-Lieferung"
          body="Genauer Zeitpunkt (z.B. Beisetzung). Wir liefern ca. eine Stunde vor der Zeremonie."
        />
      </div>
    </section>
  );
}

function FulfilmentButton({
  isSelected,
  isPending,
  onClick,
  title,
  body,
}: {
  isSelected: boolean;
  isPending: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      aria-pressed={isSelected}
      className={`text-left px-4 py-4 border transition-colors ${
        isSelected
          ? "border-bark bg-bark text-ivory"
          : "border-mist bg-ivory text-bark hover:border-bark"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className={`text-[0.85rem] font-medium ${isSelected ? "text-ivory" : "text-bark"}`}>
        {title}
      </div>
      <p className={`text-[0.75rem] mt-1 leading-[1.55] ${isSelected ? "text-cream/80" : "text-sage"}`}>
        {body}
      </p>
    </button>
  );
}
