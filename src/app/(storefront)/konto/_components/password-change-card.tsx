"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "@/lib/customer-auth/profile-actions";

/**
 * Password-change card. Collapsed by default behind a single button so the
 * /konto overview isn't dominated by rarely-used security controls.
 */
export function PasswordChangeCard() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<
    "idle" | "saved" | "rate_limited" | "wrong_current" | "weak_new" | "mismatch"
  >("idle");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setStatus("idle");
    startTransition(async () => {
      const result = await changePasswordAction(form);
      if (result.ok) {
        setStatus("saved");
        setOpen(false);
        setTimeout(() => setStatus("idle"), 3000);
        (e.target as HTMLFormElement).reset();
      } else {
        setStatus(result.reason ?? "idle");
      }
    });
  }

  if (!open) {
    return (
      <section className="rounded-lg border border-mist bg-card p-6 space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
            Sicherheit
          </h2>
          {status === "saved" && (
            <span className="text-xs text-emerald-700 animate-in fade-in duration-300">
              Passwort geändert.
            </span>
          )}
        </div>
        <p className="text-[0.85rem] text-bark/75">
          Passwort oder Zugangsdaten ändern.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-block text-[0.72rem] tracking-[0.14em] uppercase font-medium border border-bark text-bark px-5 py-2 hover:bg-bark hover:text-ivory active:translate-y-px transition-all duration-200"
        >
          Passwort ändern
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-mist bg-card p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
          Passwort ändern
        </h2>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setStatus("idle");
          }}
          className="text-xs text-sage hover:text-bark transition-colors"
        >
          Schliessen
        </button>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field
          id="currentPassword"
          name="currentPassword"
          label="Aktuelles Passwort"
          autoComplete="current-password"
        />
        <Field
          id="newPassword"
          name="newPassword"
          label="Neues Passwort"
          autoComplete="new-password"
          hint="Mindestens 8 Zeichen."
          minLength={8}
        />
        <Field
          id="confirmPassword"
          name="confirmPassword"
          label="Neues Passwort bestätigen"
          autoComplete="new-password"
          minLength={8}
        />

        {status === "wrong_current" && (
          <Alert text="Das aktuelle Passwort ist nicht korrekt." />
        )}
        {status === "weak_new" && (
          <Alert text="Das neue Passwort muss mindestens 8 Zeichen lang sein." />
        )}
        {status === "mismatch" && (
          <Alert text="Die beiden neuen Passwörter stimmen nicht überein." />
        )}
        {status === "rate_limited" && (
          <Alert text="Zu viele Versuche. Bitte warten Sie ca. 15 Minuten." />
        )}

        <button
          type="submit"
          disabled={isPending}
          className="group inline-flex items-center gap-2 bg-bark text-ivory px-5 py-2 text-[0.72rem] tracking-[0.14em] uppercase font-medium hover:bg-rose active:translate-y-px transition-all duration-200 disabled:opacity-50"
        >
          {isPending ? "Speichert…" : "Passwort speichern"}
          {!isPending && (
            <span className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          )}
        </button>
      </form>
    </section>
  );
}

function Field({
  id,
  name,
  label,
  autoComplete,
  hint,
  minLength,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  hint?: string;
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[0.68rem] tracking-[0.16em] uppercase text-sage font-medium"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        required
        autoComplete={autoComplete}
        minLength={minLength}
        className="w-full border border-mist bg-ivory px-3 py-2.5 text-[0.95rem] text-bark focus:border-rose focus:ring-2 focus:ring-rose/15 focus:outline-none transition-colors"
      />
      {hint && <p className="text-[0.7rem] text-sage">{hint}</p>}
    </div>
  );
}

function Alert({ text }: { text: string }) {
  return (
    <p className="text-[0.85rem] text-rose animate-in fade-in slide-in-from-top-1 duration-300">
      {text}
    </p>
  );
}
