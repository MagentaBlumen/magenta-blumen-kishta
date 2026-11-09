"use client";

import { useState, useTransition } from "react";
import type { CustomerAddressRow } from "@/lib/customer-auth/addresses";
import {
  addCustomerAddressAction,
  deleteCustomerAddressAction,
  updateCustomerAddressAction,
} from "@/lib/customer-auth/address-actions";

type Props = {
  addresses: CustomerAddressRow[];
};

type EditingState =
  | { mode: "list" }
  | { mode: "add" }
  | { mode: "edit"; id: number };

/**
 * Address book for repeat senders. One of three UI states:
 *   - list: shows cards for each address with Bearbeiten / Löschen
 *   - add: blank form
 *   - edit: form prefilled with a row's current values
 */
export function AddressBook({ addresses }: Props) {
  const [state, setState] = useState<EditingState>({ mode: "list" });
  const [isPending, startTransition] = useTransition();

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      if (state.mode === "add") {
        await addCustomerAddressAction(form);
      } else if (state.mode === "edit") {
        await updateCustomerAddressAction(state.id, form);
      }
      setState({ mode: "list" });
    });
  }

  function remove(id: number) {
    if (!window.confirm("Diese Adresse wirklich löschen?")) return;
    startTransition(async () => {
      await deleteCustomerAddressAction(id);
    });
  }

  if (state.mode !== "list") {
    const editing = state.mode === "edit"
      ? addresses.find((a) => a.id === state.id) ?? null
      : null;
    return (
      <section className="rounded-lg border border-mist bg-card p-6 space-y-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
            {state.mode === "add" ? "Neue Adresse" : "Adresse bearbeiten"}
          </h2>
          <button
            type="button"
            onClick={() => setState({ mode: "list" })}
            className="text-xs text-sage hover:text-bark transition-colors"
          >
            Abbrechen
          </button>
        </div>

        <form onSubmit={save} className="space-y-4">
          <Field
            label="Bezeichnung (optional)"
            name="labelDe"
            defaultValue={editing?.labelDe ?? ""}
            placeholder="z. B. Büro, Oma, Partner"
          />
          <Field
            label="Empfänger"
            name="recipientName"
            defaultValue={editing?.recipientName}
            required
            autoComplete="name"
          />
          <Field
            label="Strasse"
            name="street"
            defaultValue={editing?.street}
            required
            autoComplete="street-address"
          />
          <div className="grid grid-cols-[100px_1fr] gap-4">
            <Field
              label="PLZ"
              name="plz"
              defaultValue={editing?.plz ?? ""}
              required
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              autoComplete="postal-code"
            />
            <Field
              label="Ort"
              name="city"
              defaultValue={editing?.city}
              required
              autoComplete="address-level2"
            />
          </div>
          <Field
            label="Telefon (optional)"
            name="phone"
            type="tel"
            defaultValue={editing?.phone ?? ""}
            autoComplete="tel"
          />
          <Field
            label="Hinweise (optional)"
            name="notes"
            defaultValue={editing?.notes ?? ""}
            placeholder="z. B. Klingel geht nicht, bitte hinten lassen"
          />

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
        </form>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-mist bg-card p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
          Adressen
        </h2>
        <button
          type="button"
          onClick={() => setState({ mode: "add" })}
          className="text-xs text-rose hover:underline"
        >
          Neue Adresse
        </button>
      </div>

      {addresses.length === 0 ? (
        <p className="text-[0.85rem] text-bark/70">
          Noch keine gespeicherten Adressen. Fügen Sie eine hinzu, damit sie
          beim nächsten Bestellen vorausgefüllt werden kann.
        </p>
      ) : (
        <ul className="divide-y divide-mist border-y border-mist">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="grid grid-cols-[1fr_auto] gap-3 py-3 items-start"
            >
              <div className="min-w-0">
                {a.labelDe && (
                  <div className="text-[0.68rem] tracking-[0.14em] uppercase text-sage font-medium">
                    {a.labelDe}
                  </div>
                )}
                <div className="text-[0.9rem] text-bark font-medium">
                  {a.recipientName}
                </div>
                <div className="text-[0.82rem] text-bark/75">
                  {a.street}, {a.plz} {a.city}
                </div>
                {a.phone && (
                  <div className="text-[0.75rem] text-sage mt-0.5 tabular-nums">
                    {a.phone}
                  </div>
                )}
                {a.notes && (
                  <div className="text-[0.72rem] text-sage/80 mt-1 italic">
                    {a.notes}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={() => setState({ mode: "edit", id: a.id })}
                  className="text-xs text-rose hover:underline"
                >
                  Bearbeiten
                </button>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  disabled={isPending}
                  className="text-xs text-sage hover:text-rose transition-colors disabled:opacity-50"
                >
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  autoComplete,
  type = "text",
  inputMode,
  pattern,
  maxLength,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  type?: string;
  inputMode?: "numeric" | "text";
  pattern?: string;
  maxLength?: number;
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
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        className="w-full border border-mist bg-ivory px-3 py-2.5 text-[0.95rem] text-bark focus:border-rose focus:ring-2 focus:ring-rose/15 focus:outline-none transition-colors"
      />
    </div>
  );
}
