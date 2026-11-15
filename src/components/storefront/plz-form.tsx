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
 * re-render with the resolved-zone card.
 */
export function PlzForm({ initialPlz = "" }: { initialPlz?: string }) {
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
            "Dorthin liefern wir leider nicht. Sie können Ihre Blumen aber in unserer Werkstatt in Neuenhof abholen. (056 556 56 09)",
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap gap-2.5">
        <label htmlFor="co-plz" className="sr-only">
          Postleitzahl
        </label>
        <input
          id="co-plz"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          required
          value={plz}
          onChange={(e) => setPlz(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Postleitzahl, z. B. 5432"
          aria-label="Postleitzahl"
          className="flex-1 min-w-0 max-w-[300px] h-[52px] px-4 border border-oak bg-ivory text-bark text-[17px] focus:outline-none focus:border-rose focus:ring-2 focus:ring-rose/15 tabular-nums"
        />
        <button
          type="submit"
          disabled={isPending || plz.length !== 4}
          className="h-[52px] px-6 bg-bark text-ivory text-[15px] font-semibold hover:brightness-125 transition-[filter] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Prüfen…" : "Prüfen"}
        </button>
      </form>

      {error && (
        <p className="m-0 text-[15px] text-[#8A2E1E] leading-[1.5]">{error}</p>
      )}

      {result?.kind === "picker" && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-[14px] text-sage leading-[1.5]">
            Für die PLZ{" "}
            <span className="tabular-nums font-semibold text-bark">{plz}</span>{" "}
            gibt es mehrere Ortschaften. Bitte wählen Sie die richtige aus.
          </p>
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            {result.options.map((o) => (
              <button
                key={o.ortschaft}
                type="button"
                onClick={() => handlePickOrtschaft(o.ortschaft)}
                disabled={isPending}
                className="text-left px-4 py-3.5 border border-mist bg-white hover:border-oak transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex justify-between items-baseline gap-4">
                  <span className="text-[15px] font-semibold text-bark">
                    {o.ortschaft}
                  </span>
                  <span className="text-[14px] tabular-nums text-bark">
                    {formatChf(o.feeGross)}
                  </span>
                </div>
                <div className="text-[13px] text-sage mt-1">
                  Zone {o.zoneNameDe} · Mindest {formatChf(o.minOrderGross)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
