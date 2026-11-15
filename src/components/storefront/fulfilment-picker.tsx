"use client";

import { useTransition } from "react";
import { CoTile } from "@/components/storefront/co-tile";
import { selectFulfilmentAction } from "@/lib/checkout/actions";

// Radio pair: van delivery vs timed (funeral / wedding / event).
// Pickup is deliberately deferred — it needs no capacity guarantee and
// can land later without affecting run/timed logic.
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
    <div
      role="radiogroup"
      aria-label="Liefermethode"
      className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]"
    >
      <CoTile
        selected={value === "run"}
        onClick={() => pick("run")}
        disabled={isPending}
      >
        <span className="text-[15px] font-semibold text-bark">
          Standardlieferung
        </span>
        <span className="text-[13px] leading-[1.5] text-sage">
          Zwei Zeitfenster täglich: 10–12 oder 16–18 Uhr. Auch am Sonntag.
        </span>
      </CoTile>
      <CoTile
        selected={value === "timed"}
        onClick={() => pick("timed")}
        disabled={isPending}
      >
        <span className="text-[15px] font-semibold text-bark">
          Trauer- oder Event-Lieferung
        </span>
        <span className="text-[13px] leading-[1.5] text-sage">
          Genauer Zeitpunkt, z. B. vor einer Abdankung oder Feier.
        </span>
      </CoTile>
    </div>
  );
}
