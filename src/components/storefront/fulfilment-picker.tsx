"use client";

import { useTransition } from "react";
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
      <Tile
        isSelected={value === "run"}
        isPending={isPending}
        onClick={() => pick("run")}
        title="Standardlieferung"
        sub="Zwei Zeitfenster täglich: 10–12 oder 16–18 Uhr. Auch am Sonntag."
      />
      <Tile
        isSelected={value === "timed"}
        isPending={isPending}
        onClick={() => pick("timed")}
        title="Trauer- oder Event-Lieferung"
        sub="Genauer Zeitpunkt, z. B. vor einer Abdankung oder Feier."
      />
    </div>
  );
}

function Tile({
  isSelected,
  isPending,
  onClick,
  title,
  sub,
}: {
  isSelected: boolean;
  isPending: boolean;
  onClick: () => void;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      role="radio"
      aria-checked={isSelected}
      className={`text-left h-full px-4 py-[15px] border bg-white flex gap-3.5 items-start transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        isSelected
          ? "border-rose shadow-[0_0_0_1px_var(--color-rose)]"
          : "border-[#E1D5C7] hover:border-[#B8916A]"
      }`}
    >
      <span
        aria-hidden
        className={`shrink-0 w-[18px] h-[18px] mt-0.5 box-border ${
          isSelected
            ? "border-0 bg-rose bg-[linear-gradient(#fff,#fff)] bg-center bg-no-repeat [background-size:6px_6px]"
            : "border-[1.5px] border-[#B8916A]"
        }`}
      />
      <span className="flex flex-col gap-1 min-w-0">
        <span className="text-[15px] font-semibold text-bark">{title}</span>
        <span className="text-[13px] leading-[1.5] text-sage">{sub}</span>
      </span>
    </button>
  );
}
