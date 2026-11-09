"use client";

import { useState, useTransition } from "react";
import { updateProfileAction } from "@/lib/customer-auth/profile-actions";

type Props = {
  initial: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  };
};

/**
 * Profile card: name + phone are editable inline; email is read-only
 * for this phase (email change needs verification flow + session
 * invalidation, deferred to a later session).
 */
export function ProfileCard({ initial }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateProfileAction(form);
        setSaved(true);
        setEditing(false);
        setTimeout(() => setSaved(false), 2500);
      } catch {
        // Server action errors stay server-side; no banner for now.
      }
    });
  }

  return (
    <section className="rounded-lg border border-mist bg-card p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
          Profil
        </h2>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-rose hover:underline"
          >
            Bearbeiten
          </button>
        )}
      </div>

      {saved && (
        <div className="text-xs text-emerald-700 animate-in fade-in slide-in-from-top-1 duration-300">
          Gespeichert.
        </div>
      )}

      {editing ? (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LabelledInput
              label="Vorname"
              name="firstName"
              defaultValue={initial.firstName}
              required
              autoComplete="given-name"
            />
            <LabelledInput
              label="Nachname"
              name="lastName"
              defaultValue={initial.lastName}
              required
              autoComplete="family-name"
            />
          </div>
          <LabelledInput
            label="Telefon"
            name="phone"
            type="tel"
            defaultValue={initial.phone ?? ""}
            required
            autoComplete="tel"
          />

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="group inline-flex items-center gap-2 bg-bark text-ivory px-5 py-2 text-[0.72rem] tracking-[0.14em] uppercase font-medium hover:bg-rose active:translate-y-px transition-all duration-200 disabled:opacity-50"
            >
              {isPending ? "Speichert…" : "Speichern"}
              {!isPending && (
                <span className="transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[0.72rem] tracking-[0.14em] uppercase text-sage hover:text-bark transition-colors px-3 py-2"
            >
              Abbrechen
            </button>
          </div>
        </form>
      ) : (
        <dl className="space-y-2 text-[0.9rem]">
          <Row
            label="Name"
            value={
              [initial.firstName, initial.lastName]
                .filter(Boolean)
                .join(" ") || "–"
            }
          />
          <Row label="E-Mail" value={initial.email} muted />
          <Row label="Telefon" value={initial.phone ?? "–"} />
        </dl>
      )}

      {!editing && (
        <p className="text-[0.7rem] text-sage pt-1">
          E-Mail-Adresse ändern? Rufen Sie uns an unter{" "}
          <a href="tel:+41565565609" className="text-rose hover:underline">
            056 556 56 09
          </a>
          .
        </p>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2">
      <dt className="text-sage">{label}</dt>
      <dd className={muted ? "text-bark/70" : "text-bark"}>{value}</dd>
    </div>
  );
}

function LabelledInput({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  autoComplete,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-[0.68rem] tracking-[0.16em] uppercase text-sage font-medium"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        autoComplete={autoComplete}
        className="w-full border border-mist bg-ivory px-3 py-2.5 text-[0.95rem] text-bark focus:border-rose focus:ring-2 focus:ring-rose/15 focus:outline-none transition-colors"
      />
    </div>
  );
}
