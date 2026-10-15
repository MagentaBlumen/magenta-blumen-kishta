"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Storefront error boundary. Catches thrown errors from any page under
 * (storefront)/. Must be a client component - Next.js requirement.
 *
 * We log to Sentry on mount so unhandled errors land in triage. The
 * digest (set by Next.js on server-thrown errors) is shown in small
 * text so if a customer calls in we can grep the server log for it.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-4 lg:px-6 py-20 lg:py-28 text-center space-y-6">
      <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
        Technischer Fehler
      </p>
      <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
        Da hat etwas nicht geklappt.
      </h1>
      <p className="text-[0.9rem] text-bark/75 leading-[1.7] font-light">
        Wir wurden benachrichtigt und schauen es uns an. Versuchen Sie es
        bitte erneut, oder rufen Sie uns an - wir nehmen Ihre Bestellung
        gerne telefonisch auf.
      </p>
      <div className="pt-6 flex flex-wrap gap-3 justify-center">
        <button
          type="button"
          onClick={reset}
          className="inline-block bg-bark text-ivory px-9 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose transition-colors"
        >
          Erneut versuchen
        </button>
        <a
          href="tel:+41565565609"
          className="inline-block border border-bark text-bark px-9 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-bark hover:text-ivory transition-colors"
        >
          Anrufen . 056 556 56 09
        </a>
      </div>
      {error.digest && (
        <p className="text-[0.68rem] text-sage pt-4 font-mono">
          Referenz: {error.digest}
        </p>
      )}
    </div>
  );
}
