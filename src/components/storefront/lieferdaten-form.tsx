"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CoBox } from "@/components/storefront/co-box";
import { CoTile } from "@/components/storefront/co-tile";
import { submitDetailsAction } from "@/lib/checkout/actions";
import type { CustomerAddressRow } from "@/lib/customer-auth/addresses";
import type {
  CheckoutCookie,
  DeliveryContextCookie,
  ResolvedZone,
} from "@/lib/checkout/types";

// Buyer + recipient + delivery-context form, laid out as three numbered
// boxes (Wer bekommt / Karte & Hinweise / Ihre Angaben). Uncontrolled
// inputs with defaultValue from the cookie; the server action re-reads
// FormData and re-validates every field.
//
// Client state drives three visibility toggles:
//   - `context`: which conditional fields (hospital ward, funeral family)
//   - `forSelf`: hides recipient-person fields; buyer gets copied into
//     recipient_name / recipient_phone at submit
//   - `cardLen`: live char counter on the Grusskarte textarea
export function LieferdatenForm({
  defaults,
  zone,
  savedAddresses = [],
  totalSavedCount = 0,
}: {
  defaults: CheckoutCookie;
  zone: ResolvedZone;
  savedAddresses?: CustomerAddressRow[];
  totalSavedCount?: number;
}) {
  const [context, setContext] = useState<DeliveryContextCookie>(
    defaults.dc ?? "residential",
  );
  const [forSelf, setForSelf] = useState(false);
  const [cardLen, setCardLen] = useState(defaults.cm?.length ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Recipient fields are controlled so picking a saved address can fill
  // them in-place. Picking tracks selected id for the picker's visual
  // state; manual edits clear it so the "picked" highlight goes away.
  const [recipientName, setRecipientName] = useState(defaults.rn ?? "");
  const [recipientPhone, setRecipientPhone] = useState(defaults.rp ?? "");
  const [street, setStreet] = useState(defaults.st ?? "");
  const [pickedAddressId, setPickedAddressId] = useState<number | null>(null);

  function pickSavedAddress(addr: CustomerAddressRow) {
    setRecipientName(addr.recipientName);
    setRecipientPhone(addr.phone ?? "");
    setStreet(addr.street);
    setPickedAddressId(addr.id);
  }

  async function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        formData.set("dc", context);
        if (forSelf) {
          const bn = formData.get("bn");
          const bp = formData.get("bp");
          if (typeof bn === "string") formData.set("rn", bn);
          if (typeof bp === "string" && bp) formData.set("rp", bp);
        }
        await submitDetailsAction(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="m-0 px-4 py-3 border border-rose/40 bg-rose/5 text-[13px] text-bark leading-[1.5]"
        >
          {error}
        </p>
      )}

      <CoBox
        number={1}
        title="Wer bekommt die Blumen?"
        hint="Name und Adresse der Person, die die Blumen erhält."
      >
        {!forSelf && savedAddresses.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-bark">
              Aus dem Adressbuch wählen
            </span>
            <div
              role="radiogroup"
              aria-label="Gespeicherte Adresse wählen"
              className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]"
            >
              {savedAddresses.map((a) => (
                <SavedAddressTile
                  key={a.id}
                  address={a}
                  selected={pickedAddressId === a.id}
                  onSelect={() => pickSavedAddress(a)}
                />
              ))}
            </div>
            <span className="text-[12px] text-sage">
              Nur Adressen mit PLZ {zone.plz} werden angezeigt. Sie können
              die Felder unten jederzeit anpassen.
            </span>
          </div>
        )}

        {!forSelf &&
          savedAddresses.length === 0 &&
          totalSavedCount > 0 && (
            <p className="m-0 px-3 py-2.5 bg-cream border border-hair text-[13px] text-sage leading-[1.5]">
              Sie haben {totalSavedCount}{" "}
              {totalSavedCount === 1
                ? "gespeicherte Adresse"
                : "gespeicherte Adressen"}
              , aber keine davon hat PLZ {zone.plz}. Mit einer anderen
              Lieferadresse geht es{" "}
              <Link
                href="/kasse/lieferung"
                className="underline text-sage hover:text-rose"
              >
                über «PLZ ändern»
              </Link>
              .
            </p>
          )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={forSelf}
            onChange={(e) => setForSelf(e.target.checked)}
            className="w-5 h-5 mt-0.5 accent-rose shrink-0"
          />
          <span className="flex flex-col gap-0.5">
            <strong className="text-[15px] font-semibold text-bark">
              Die Blumen sind für mich
            </strong>
            <span className="text-[13px] text-sage">
              Wir füllen Empfänger-Name und -Telefon aus Ihren Angaben
              weiter unten.
            </span>
          </span>
        </label>

        {!forSelf && (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <ControlledField
              name="rn"
              label="Name der empfangenden Person"
              required
              value={recipientName}
              onChange={(v) => {
                setRecipientName(v);
                setPickedAddressId(null);
              }}
              autoComplete="off"
            />
            <ControlledField
              name="rp"
              label="Telefon der empfangenden Person"
              optional
              type="tel"
              value={recipientPhone}
              onChange={(v) => {
                setRecipientPhone(v);
                setPickedAddressId(null);
              }}
              hint="Nur für die Zustellung. Wir rufen nie ohne Grund an."
            />
          </div>
        )}

        <div className="grid gap-4 [grid-template-columns:2fr_1fr] max-[640px]:grid-cols-1">
          <ControlledField
            name="st"
            label="Strasse und Hausnummer"
            required
            value={street}
            onChange={(v) => {
              setStreet(v);
              setPickedAddressId(null);
            }}
            autoComplete="street-address"
          />
          <ReadOnlyField
            label="PLZ / Ort"
            value={`${zone.plz} ${zone.ortschaft}`}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold text-bark">
            Art der Adresse
          </span>
          <div
            role="radiogroup"
            aria-label="Art der Adresse"
            className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]"
          >
            <ContextTile
              value="residential"
              current={context}
              onSelect={setContext}
              title="Privatadresse"
              sub="Nach Hause."
            />
            <ContextTile
              value="business"
              current={context}
              onSelect={setContext}
              title="Firma / Büro"
              sub="An Rezeption oder Empfang."
            />
            <ContextTile
              value="hospital"
              current={context}
              onSelect={setContext}
              title="Spital"
              sub="An die Station – nicht auf die Intensivstation."
            />
            <ContextTile
              value="funeral"
              current={context}
              onSelect={setContext}
              title="Trauerort"
              sub="Kirche, Friedhof oder Abdankungshalle."
            />
          </div>
        </div>

        {context === "hospital" && (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <Field
              name="dw"
              label="Station"
              required
              defaultValue={defaults.dw}
            />
            <Field
              name="dm"
              label="Zimmer"
              optional
              defaultValue={defaults.dm}
            />
          </div>
        )}

        {context === "funeral" && (
          <>
            <Field
              name="dn"
              label="Name der verstorbenen Person"
              required
              defaultValue={defaults.dn}
            />
            <Field
              name="fc"
              label="Telefon einer Familienperson"
              required
              type="tel"
              defaultValue={defaults.fc}
              hint="Für Rückfragen. Nicht öffentlich sichtbar."
            />
          </>
        )}
      </CoBox>

      <CoBox
        number={2}
        title="Karte & Hinweise"
        hint="Wir schreiben Ihre Karte von Hand."
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="co-card"
            className="text-[13px] font-semibold text-bark"
          >
            Text der Grusskarte{" "}
            <span className="font-normal text-sage">(optional)</span>
          </label>
          <textarea
            id="co-card"
            name="cm"
            rows={3}
            maxLength={200}
            defaultValue={defaults.cm}
            onInput={(e) => setCardLen(e.currentTarget.value.length)}
            placeholder="Ihre Nachricht"
            className="w-full px-4 py-3.5 border border-mist bg-cream text-bark font-display italic text-[17px] leading-[1.5] focus:outline-none focus:border-rose focus:ring-2 focus:ring-rose/15"
          />
          <span className="self-end text-[12px] text-sage tabular-nums">
            {cardLen} / 200
          </span>
        </div>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="ca"
            defaultChecked={defaults.ca === true}
            className="w-5 h-5 mt-0.5 accent-rose shrink-0"
          />
          <span className="flex flex-col gap-0.5">
            <strong className="text-[15px] font-semibold text-bark">
              Anonym senden
            </strong>
            <span className="text-[13px] text-sage">
              Kein Absendername auf der Karte.
            </span>
          </span>
        </label>

        {context === "funeral" && (
          <Field
            name="rt"
            label="Trauerband-Text"
            optional
            defaultValue={defaults.rt}
            hint="Wird auf ein Band gedruckt. Kurz halten."
          />
        )}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="co-notes"
            className="text-[13px] font-semibold text-bark"
          >
            Hinweise zur Lieferung{" "}
            <span className="font-normal text-sage">(optional)</span>
          </label>
          <textarea
            id="co-notes"
            name="di"
            rows={2}
            maxLength={500}
            defaultValue={defaults.di}
            placeholder="z. B. beim Nachbarn abgeben, Code am Eingang"
            className="w-full px-4 py-3 border border-mist bg-ivory text-bark text-[15px] leading-[1.5] focus:outline-none focus:border-rose focus:ring-2 focus:ring-rose/15"
          />
        </div>
      </CoBox>

      <CoBox
        number={3}
        title="Ihre Angaben"
        hint="Für die Rechnung und für Rückfragen."
      >
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <Field
            name="bn"
            label="Ihr Name"
            required
            defaultValue={defaults.bn}
            autoComplete="name"
          />
          <Field
            name="bp"
            label="Telefon"
            required
            type="tel"
            defaultValue={defaults.bp}
            autoComplete="tel"
            placeholder="079 123 45 67"
            hint="Für Rückfragen bei Lieferproblemen."
          />
        </div>
        <Field
          name="be"
          label="E-Mail"
          required
          type="email"
          defaultValue={defaults.be}
          autoComplete="email"
          placeholder="name@beispiel.ch"
          hint="Für die Bestellbestätigung."
        />
      </CoBox>

      <div className="flex flex-col gap-3.5 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="flex items-center justify-center gap-2.5 h-14 bg-rose text-ivory text-[16px] font-semibold tracking-[0.02em] hover:brightness-110 transition-[filter] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Bitte warten…" : "Weiter zur Übersicht"}
          {!isPending && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          )}
        </button>
        <Link
          href="/kasse/lieferung"
          className="self-start inline-flex items-center gap-2 text-[14px] font-semibold text-bark hover:text-rose transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M19 12H5M11 18l-6-6 6-6" />
          </svg>
          Zurück zur Lieferung
        </Link>
      </div>
    </form>
  );
}

// ---------------- Building blocks ----------------

function Field({
  name,
  label,
  required = false,
  optional = false,
  defaultValue,
  hint,
  type = "text",
  autoComplete,
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  defaultValue?: string;
  hint?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={name} className="text-[13px] font-semibold text-bark">
        {label}{" "}
        {required && (
          <span className="text-rose" aria-hidden>
            *
          </span>
        )}
        {optional && (
          <span className="font-normal text-sage">(optional)</span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full h-[52px] px-3.5 border border-mist bg-ivory text-bark text-[16px] focus:outline-none focus:border-rose focus:ring-2 focus:ring-rose/15"
      />
      {hint && <span className="text-[12px] text-sage">{hint}</span>}
    </div>
  );
}

function ControlledField({
  name,
  label,
  required = false,
  optional = false,
  value,
  onChange,
  hint,
  type = "text",
  autoComplete,
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={name} className="text-[13px] font-semibold text-bark">
        {label}{" "}
        {required && (
          <span className="text-rose" aria-hidden>
            *
          </span>
        )}
        {optional && (
          <span className="font-normal text-sage">(optional)</span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full h-[52px] px-3.5 border border-mist bg-ivory text-bark text-[16px] focus:outline-none focus:border-rose focus:ring-2 focus:ring-rose/15"
      />
      {hint && <span className="text-[12px] text-sage">{hint}</span>}
    </div>
  );
}

function SavedAddressTile({
  address,
  selected,
  onSelect,
}: {
  address: CustomerAddressRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <CoTile selected={selected} onClick={onSelect}>
      {address.labelDe && (
        <span className="text-[11px] font-semibold tracking-[0.14em] uppercase text-sage">
          {address.labelDe}
        </span>
      )}
      <span className="font-display text-[17px] leading-[1.2] text-bark truncate">
        {address.recipientName}
      </span>
      <span className="text-[13px] text-bark truncate">{address.street}</span>
      {address.phone && (
        <span className="text-[12px] text-sage tabular-nums">
          {address.phone}
        </span>
      )}
    </CoTile>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[13px] font-semibold text-bark">{label}</span>
      <input
        type="text"
        readOnly
        value={value}
        className="w-full h-[52px] px-3.5 border border-mist bg-cream text-bark text-[16px]"
      />
    </div>
  );
}

function ContextTile({
  value,
  current,
  onSelect,
  title,
  sub,
}: {
  value: DeliveryContextCookie;
  current: DeliveryContextCookie;
  onSelect: (v: DeliveryContextCookie) => void;
  title: string;
  sub: string;
}) {
  return (
    <CoTile
      selected={current === value}
      onClick={() => onSelect(value)}
    >
      <span className="text-[15px] font-semibold text-bark">{title}</span>
      <span className="text-[13px] leading-[1.5] text-sage">{sub}</span>
    </CoTile>
  );
}
