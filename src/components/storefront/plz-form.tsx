"use client";

import { useState, useTransition } from "react";
import { formatChf } from "@/lib/money";
import {
  submitOrtschaftAction,
  submitPlzAction,
  type SubmitPlzResult,
} from "@/lib/checkout/actions";

/**
 * PLZ input + inline Ortschaft picker.
 *
 * Two-phase interaction:
 *   1. Type a PLZ, submit -> server action returns "none" | "single" | "picker".
 *   2. If "picker", render the options in place; picking one submits the
 *      Ortschaft action which cements the zone in the cookie.
 *
 * "single" writes the whole (plz, ort, zid) to the cookie server-side
 * and the layout revalidation causes the server component above to
 * re-render with the resolved-zone card. This client component then
 * only lives for the "enter PLZ" phase.
 */
export function PlzForm({
  initialPlz = "",
}: {
  initialPlz?: string;
}) {
  const [plz, setPlz] = useState(initialPlz);
  const [result, setResult] = useState<SubmitPlzResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await submitPlzAction(plz);
        setResult(r);
        if (r.kind === "none") {
          setError(
            "Wir liefern leider nicht an diese Postleitzahl. Bitte kommen Sie im Laden vorbei oder rufen Sie uns an: 056 556 56 09.",
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  function handlePickOrtschaft(ortschaft: string) {
    setError(null);
    startTransition(async () => {
      try {
        await submitOrtschaftAction(plz, ortschaft);
        // The server action revalidates the page; the parent server
        // component will re-render with the resolved zone. No local
        // state to clear - this component unmounts.
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          value={plz}
          onChange={(e) => setPlz(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="PLZ (z.B. 5432)"
          aria-label="Postleitzahl"
          className="flex-1 h-[50px] px-4 border border-mist bg-ivory text-bark text-[0.95rem] focus:outline-none focus:border-bark tabular-nums"
        />
        <button
          type="submit"
          disabled={isPending || plz.length !== 4}
          className="h-[50px] px-8 bg-bark text-ivory text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Prüfen ..." : "Prüfen"}
        </button>
      </form>

      {error && (
        <p className="px-4 py-3 border border-rose/30 bg-rose/5 text-[0.85rem] text-bark leading-[1.55]">
          {error}
        </p>
      )}

      {result?.kind === "picker" && (
        <div className="space-y-3">
          <p className="text-[0.85rem] text-bark leading-[1.55]">
            Für die PLZ <span className="tabular-nums font-medium">{plz}</span>{" "}
            gibt es zwei Ortschaften. Bitte wählen Sie die richtige aus:
          </p>
          <div className="grid gap-2">
            {result.options.map((o) => (
              <button
                key={o.ortschaft}
                type="button"
                onClick={() => handlePickOrtschaft(o.ortschaft)}
                disabled={isPending}
                className="text-left px-4 py-3 border border-mist hover:border-bark hover:bg-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex justify-between items-baseline gap-4">
                  <span className="text-[0.95rem] text-bark font-medium">
                    {o.ortschaft}
                  </span>
                  <span className="text-[0.85rem] tabular-nums text-bark">
                    {formatChf(o.feeGross)}
                  </span>
                </div>
                <div className="text-[0.72rem] text-sage mt-1">
                  Zone {o.zoneNameDe} · Mindestbestellwert {formatChf(o.minOrderGross)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
