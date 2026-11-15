"use client";

import { useState, useTransition } from "react";
import type { CustomerAddressRow } from "@/lib/customer-auth/addresses";
import type { SuggestedAddress } from "@/lib/customer-auth/suggested-address";
import {
  addCustomerAddressAction,
  deleteCustomerAddressAction,
  updateCustomerAddressAction,
} from "@/lib/customer-auth/address-actions";

type Props = {
  addresses: CustomerAddressRow[];
  suggestion: SuggestedAddress | null;
};

type Mode =
  | { kind: "grid" }
  | { kind: "add" }
  | { kind: "edit"; id: number };

export function AddressBook({ addresses, suggestion }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: "grid" });
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      if (mode.kind === "add") {
        await addCustomerAddressAction(form);
      } else if (mode.kind === "edit") {
        await updateCustomerAddressAction(mode.id, form);
      }
      setMode({ kind: "grid" });
    });
  }

  function handleRemove(id: number) {
    if (!window.confirm("Diese Adresse wirklich entfernen?")) return;
    startTransition(async () => {
      await deleteCustomerAddressAction(id);
    });
  }

  function handleSaveSuggestion() {
    if (!suggestion) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("recipientName", suggestion.recipientName);
      fd.set("street", suggestion.street);
      fd.set("plz", suggestion.plz);
      fd.set("city", suggestion.city);
      if (suggestion.phone) fd.set("phone", suggestion.phone);
      await addCustomerAddressAction(fd);
    });
  }

  if (mode.kind !== "grid") {
    const editing =
      mode.kind === "edit"
        ? addresses.find((a) => a.id === mode.id) ?? null
        : null;
    return (
      <AddressForm
        editing={editing}
        isNew={mode.kind === "add"}
        isPending={isPending}
        onSubmit={handleSubmit}
        onCancel={() => setMode({ kind: "grid" })}
      />
    );
  }

  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
      {addresses.map((a) => (
        <SavedCard
          key={a.id}
          address={a}
          onEdit={() => setMode({ kind: "edit", id: a.id })}
          onRemove={() => handleRemove(a.id)}
          disabled={isPending}
        />
      ))}
      {suggestion && (
        <SuggestionCard
          suggestion={suggestion}
          onSave={handleSaveSuggestion}
          disabled={isPending}
        />
      )}
      <button
        type="button"
        onClick={() => setMode({ kind: "add" })}
        className="min-h-[170px] border border-dashed border-oak flex flex-col items-center justify-center gap-2.5 text-[15px] font-semibold text-bark hover:border-rose hover:text-rose transition-colors"
      >
        <span
          aria-hidden
          className="w-11 h-11 bg-cream grid place-items-center"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        Neue Adresse
      </button>
    </div>
  );
}

function SavedCard({
  address,
  onEdit,
  onRemove,
  disabled,
}: {
  address: CustomerAddressRow;
  onEdit: () => void;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <div className="border border-mist p-[22px] flex flex-col gap-1 text-[14px] leading-[1.5]">
      {address.labelDe && (
        <span className="text-[12px] font-semibold tracking-[0.14em] uppercase text-sage">
          {address.labelDe}
        </span>
      )}
      <span className="font-display text-[20px] text-bark">
        {address.recipientName}
      </span>
      <span className="text-bark">
        {address.street}, {address.plz} {address.city}
      </span>
      {address.phone && (
        <span className="text-sage tabular-nums">{address.phone}</span>
      )}
      {address.notes && (
        <span className="text-[13px] text-sage italic">{address.notes}</span>
      )}
      <div className="flex gap-4 mt-2.5">
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          className="underline text-[13px] text-sage hover:text-rose transition-colors disabled:opacity-50"
        >
          Bearbeiten
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="underline text-[13px] text-sage hover:text-rose transition-colors disabled:opacity-50"
        >
          Entfernen
        </button>
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onSave,
  disabled,
}: {
  suggestion: SuggestedAddress;
  onSave: () => void;
  disabled: boolean;
}) {
  return (
    <div className="border border-rose shadow-[0_0_0_1px_var(--color-rose)] p-[22px] flex flex-col gap-3 text-[14px] leading-[1.5]">
      <span className="text-[12px] font-semibold tracking-[0.14em] uppercase text-rose">
        Vorschlag
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-[20px] text-bark">
          {suggestion.recipientName}
        </span>
        <span className="text-bark">
          {suggestion.street}, {suggestion.plz} {suggestion.city}
        </span>
        <span className="text-[13px] text-sage">
          aus Ihrer letzten Bestellung
        </span>
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="self-start inline-flex items-center gap-2 h-11 px-4 bg-rose text-ivory text-[14px] font-semibold hover:brightness-110 transition-[filter] disabled:opacity-50"
      >
        {disabled ? "Speichert…" : "Speichern"}
      </button>
    </div>
  );
}

function AddressForm({
  editing,
  isNew,
  isPending,
  onSubmit,
  onCancel,
}: {
  editing: CustomerAddressRow | null;
  isNew: boolean;
  isPending: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <section className="border border-mist p-6 flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 font-display text-[22px] text-bark">
          {isNew ? "Neue Adresse" : "Adresse bearbeiten"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-[13px] text-sage hover:text-bark transition-colors"
        >
          Abbrechen
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
          className="self-start inline-flex items-center gap-2 h-11 px-5 bg-rose text-ivory text-[14px] font-semibold hover:brightness-110 transition-[filter] disabled:opacity-50"
        >
          {isPending ? "Speichert…" : "Speichern"}
        </button>
      </form>
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
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={name}
        className="text-[12px] font-semibold tracking-[0.14em] uppercase text-sage"
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
        className="w-full border border-mist bg-ivory px-3 py-2.5 text-[15px] text-bark focus:border-rose focus:outline-none focus:ring-2 focus:ring-rose/15 transition-colors"
      />
    </div>
  );
}
