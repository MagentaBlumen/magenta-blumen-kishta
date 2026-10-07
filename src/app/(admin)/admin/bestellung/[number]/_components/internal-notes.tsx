"use client";

import { useState, useTransition } from "react";
import { updateInternalNotesAction } from "../actions";

/**
 * Shop-only notes textarea. Never rendered to the customer, never
 * printed on the Bon. "Called about address", "second attempt
 * Saturday", etc. Server action trims + caps at 2000 chars.
 */
export function InternalNotesEditor({
  orderNumber,
  initial,
}: {
  orderNumber: string;
  initial: string | null;
}) {
  const [value, setValue] = useState<string>(initial ?? "");
  const [savedValue, setSavedValue] = useState<string>(initial ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = value !== savedValue;

  function save() {
    setStatus("idle");
    setErrorMsg(null);
    startTransition(async () => {
      try {
        await updateInternalNotesAction(orderNumber, value);
        setSavedValue(value);
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1800);
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Fehler beim Speichern");
      }
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, 2000))}
        rows={4}
        placeholder="Interne Notizen (nicht sichtbar für Kunden)"
        className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          onClick={save}
          disabled={isPending || !dirty}
          className="h-8 px-3 bg-foreground text-background rounded-md font-medium disabled:opacity-50"
        >
          {isPending ? "Wird gespeichert …" : "Speichern"}
        </button>
        {status === "saved" && !dirty && (
          <span className="text-emerald-600">✓ Gespeichert</span>
        )}
        {status === "error" && errorMsg && (
          <span className="text-rose-600">{errorMsg}</span>
        )}
        <span className="text-muted-foreground ml-auto tabular-nums">
          {value.length}/2000
        </span>
      </div>
    </div>
  );
}
