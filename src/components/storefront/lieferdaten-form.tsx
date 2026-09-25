"use client";

import { useState, useTransition } from "react";
import { submitDetailsAction } from "@/lib/checkout/actions";
import type { CheckoutCookie, DeliveryContextCookie } from "@/lib/checkout/types";

/**
 * Buyer + recipient + delivery-context form.
 *
 * Uncontrolled inputs with defaultValue from the cookie - the SERVER
 * action reads FormData and re-validates every field. Only the delivery
 * context radio drives client state, because it toggles which
 * conditional fields are visible.
 *
 * Submission uses useTransition so errors from the action surface as
 * an inline banner instead of a full-page throw.
 */
export function LieferdatenForm({ defaults }: { defaults: CheckoutCookie }) {
  const [context, setContext] = useState<DeliveryContextCookie>(
    defaults.dc ?? "residential",
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        // Ensure the current context radio value goes to the action
        // even if the field name is duplicated by other inputs.
        formData.set("dc", context);
        await submitDetailsAction(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-8">
      {error && (
        <p className="px-4 py-3 border border-rose/30 bg-rose/5 text-[0.85rem] text-bark">
          {error}
        </p>
      )}

      {/* ------------ Buyer ------------ */}
      <Section title="Ihre Angaben (Rechnungsempfänger)">
        <TwoCol>
          <Field label="Name" name="bn" required defaultValue={defaults.bn} autoComplete="name" />
          <Field
            label="Telefon"
            name="bp"
            required
            defaultValue={defaults.bp}
            autoComplete="tel"
            type="tel"
            hint="Für Rückfragen bei Lieferproblemen."
          />
        </TwoCol>
        <Field
          label="E-Mail"
          name="be"
          required
          defaultValue={defaults.be}
          autoComplete="email"
          type="email"
        />
      </Section>

      {/* ------------ Recipient + address ------------ */}
      <Section title="Empfänger und Adresse">
        <Field
          label="Name der empfangenden Person"
          name="rn"
          required
          defaultValue={defaults.rn}
          autoComplete="off"
          hint="Wer soll die Blumen erhalten?"
        />
        <Field
          label="Strasse und Hausnummer"
          name="st"
          required
          defaultValue={defaults.st}
          autoComplete="address-line1"
        />
        <Field
          label="Telefon der empfangenden Person (optional)"
          name="rp"
          defaultValue={defaults.rp}
          autoComplete="off"
          type="tel"
          hint="Nur für die Zustellung. Wir rufen nie ohne Grund an."
        />
      </Section>

      {/* ------------ Delivery context ------------ */}
      <Section title="Wohin liefern wir?">
        <div className="grid gap-2 sm:grid-cols-2">
          <ContextRadio
            value="residential"
            current={context}
            onChange={setContext}
            title="Privatadresse"
            body="Standardlieferung an ein Zuhause."
          />
          <ContextRadio
            value="business"
            current={context}
            onChange={setContext}
            title="Firma / Büro"
            body="Rezeption oder Empfang."
          />
          <ContextRadio
            value="hospital"
            current={context}
            onChange={setContext}
            title="Spital"
            body="Wir liefern nur an Stationen, nicht auf die Intensivstation."
          />
          <ContextRadio
            value="funeral"
            current={context}
            onChange={setContext}
            title="Trauerort"
            body="Kirche, Friedhof oder Abdankungshalle."
          />
        </div>

        {context === "hospital" && (
          <div className="pt-3 space-y-3">
            <TwoCol>
              <Field
                label="Abteilung / Station"
                name="dw"
                required
                defaultValue={defaults.dw}
              />
              <Field
                label="Zimmer (optional)"
                name="dm"
                defaultValue={defaults.dm}
              />
            </TwoCol>
            <p className="text-[0.72rem] text-sage leading-[1.55]">
              Viele Schweizer Spitäler nehmen nur Sträusse an (keine Erde,
              kein Steckschaum) und nichts für die Intensivstation.
            </p>
          </div>
        )}

        {context === "funeral" && (
          <div className="pt-3 space-y-3">
            <Field
              label="Name der verstorbenen Person"
              name="dn"
              required
              defaultValue={defaults.dn}
            />
            <Field
              label="Telefon einer Familienperson"
              name="fc"
              required
              defaultValue={defaults.fc}
              type="tel"
              hint="Für Rückfragen. Nicht öffentlich sichtbar."
            />
          </div>
        )}
      </Section>

      {/* ------------ Card + delivery instructions ------------ */}
      <Section title="Karte und Hinweise">
        <TextArea
          label="Kartentext (optional)"
          name="cm"
          defaultValue={defaults.cm}
          maxLength={500}
          rows={4}
          hint="Handgeschrieben auf einer beiliegenden Karte."
        />
        <label className="flex items-start gap-2 text-[0.8rem] text-bark">
          <input
            type="checkbox"
            name="ca"
            defaultChecked={defaults.ca === true}
            className="mt-1 h-4 w-4 border border-mist accent-rose"
          />
          Anonym senden (kein Absender auf der Karte)
        </label>

        {context === "funeral" && (
          <Field
            label="Trauerband-Text (optional)"
            name="rt"
            defaultValue={defaults.rt}
            hint="Wird auf ein Band gedruckt. Kurz halten."
          />
        )}

        <TextArea
          label="Hinweise zur Lieferung (optional)"
          name="di"
          defaultValue={defaults.di}
          maxLength={500}
          rows={3}
          hint="Z.B. beim Nachbarn abgeben oder ein Sicherheitscode am Eingang."
        />
      </Section>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="w-full h-[52px] bg-rose text-ivory text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-[#831249] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Bitte warten ..." : "Weiter zur Bestätigung"}
        </button>
      </div>
    </form>
  );
}

// ---------------- Building blocks ----------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[0.72rem] tracking-[0.16em] uppercase font-medium text-bark">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  name,
  required = false,
  defaultValue,
  hint,
  type = "text",
  autoComplete,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[0.72rem] text-bark">
        {label}
        {required && <span className="text-rose ml-0.5" aria-hidden>*</span>}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        className="w-full h-[42px] px-3 border border-mist bg-ivory text-[0.9rem] text-bark focus:outline-none focus:border-bark"
      />
      {hint && <span className="block text-[0.7rem] text-sage">{hint}</span>}
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
  hint,
  maxLength,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[0.72rem] text-bark">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        maxLength={maxLength}
        className="w-full px-3 py-2 border border-mist bg-ivory text-[0.9rem] text-bark focus:outline-none focus:border-bark resize-y"
      />
      {hint && <span className="block text-[0.7rem] text-sage">{hint}</span>}
    </label>
  );
}

function ContextRadio({
  value,
  current,
  onChange,
  title,
  body,
}: {
  value: DeliveryContextCookie;
  current: DeliveryContextCookie;
  onChange: (v: DeliveryContextCookie) => void;
  title: string;
  body: string;
}) {
  const isSelected = current === value;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      aria-pressed={isSelected}
      className={`text-left px-4 py-3 border transition-colors ${
        isSelected
          ? "border-bark bg-bark text-ivory"
          : "border-mist text-bark hover:border-bark"
      }`}
    >
      <div className={`text-[0.85rem] font-medium ${isSelected ? "text-ivory" : "text-bark"}`}>
        {title}
      </div>
      <p
        className={`text-[0.72rem] mt-1 leading-[1.55] ${isSelected ? "text-cream/80" : "text-sage"}`}
      >
        {body}
      </p>
    </button>
  );
}
