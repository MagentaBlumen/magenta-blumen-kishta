"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { updateSettings } from "@/app/(admin)/admin/einstellungen/actions";

export type StepperField = {
  key: string;
  label: string;
  hint?: string;
  unit: string;
  step: number;
  max: number;
  initial: string;
  showCutoffExample?: boolean;
  codeTag?: string; // developer-section field shows its key in small type
};

export type Section = {
  title?: string;
  description?: string;
  fields: StepperField[];
};

// All stepper fields in one form. Save bar is sticky at the bottom and
// appears when any field is dirty; Discard resets to initial, Save
// POSTs via the existing updateSettings server action.
export function SettingsForm({
  shopFields,
  developerFields,
  initialValues,
  moreChildren,
  extraHidden,
}: {
  shopFields: StepperField[];
  developerFields: StepperField[];
  initialValues: Record<string, string>;
  moreChildren: React.ReactNode;
  extraHidden?: Record<string, string>;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    ...initialValues,
  });
  const [moreOpen, setMoreOpen] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const dirty = useMemo(() => {
    for (const k of Object.keys(initialValues)) {
      if (values[k] !== initialValues[k]) return true;
    }
    return false;
  }, [values, initialValues]);

  const cutoffHours = Number(values["same_day_cutoff_hours"]) || 0;
  const cutoffExample = formatHhmm(Math.max(0, 16 - cutoffHours));

  function set(key: string, next: string) {
    setValues((v) => ({ ...v, [key]: next }));
    setShowSaved(false);
  }

  function bump(f: StepperField, dir: 1 | -1) {
    const n = Number(values[f.key] ?? "0") || 0;
    const nextRaw = n + dir * f.step;
    const bounded = Math.max(0, Math.min(f.max, nextRaw));
    set(f.key, String(bounded));
  }

  function discard() {
    setValues({ ...initialValues });
    setShowSaved(false);
  }

  async function onSubmit(fd: FormData) {
    startTransition(async () => {
      try {
        await updateSettings(fd);
        setShowSaved(true);
      } catch (err) {
        console.error("settings save failed:", err);
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      noValidate
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      <section className="panel" aria-label="Shop">
        {shopFields.map((f, i) => (
          <SettingRow
            key={f.key}
            field={f}
            value={values[f.key] ?? ""}
            onChange={(v) => set(f.key, v)}
            onStep={(dir) => bump(f, dir)}
            cutoffExample={f.showCutoffExample ? cutoffExample : undefined}
            isFirst={i === 0}
          />
        ))}
      </section>

      <button
        type="button"
        className="btn more-toggle"
        aria-expanded={moreOpen}
        aria-controls="more"
        onClick={() => setMoreOpen((o) => !o)}
      >
        {moreOpen ? "Weitere Angaben ausblenden" : "Weitere Angaben anzeigen"}
      </button>

      <section
        id="more"
        className="panel panel--more"
        aria-label="Weitere Angaben"
        hidden={!moreOpen}
      >
        {moreChildren}
        <div>
          <h2>Für Entwickler</h2>
          <p className="hint">
            Nur ändern, wenn Ihr Entwickler es sagt. Zeitzone: Europe/Zurich.
          </p>
          {developerFields.map((f) => (
            <SettingRow
              key={f.key}
              field={f}
              value={values[f.key] ?? ""}
              onChange={(v) => set(f.key, v)}
              onStep={(dir) => bump(f, dir)}
            />
          ))}
        </div>
      </section>

      {extraHidden &&
        Object.entries(extraHidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}

      {dirty && (
        <div className="savebar" role="region" aria-label="Speichern">
          <button
            type="button"
            className="btn"
            onClick={discard}
            disabled={isPending}
          >
            Verwerfen
          </button>
          <button
            type="submit"
            className="btn btn--main"
            disabled={isPending}
          >
            <svg
              className="icon"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12l5 5 9-10" />
            </svg>
            {isPending ? "Speichert…" : "Speichern"}
          </button>
        </div>
      )}

      {showSaved && !dirty && (
        <p className="saved" role="status">
          <svg
            className="icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M5 12l5 5 9-10" />
          </svg>
          Gespeichert.
        </p>
      )}
    </form>
  );
}

function SettingRow({
  field,
  value,
  onChange,
  onStep,
  cutoffExample,
  isFirst,
}: {
  field: StepperField;
  value: string;
  onChange: (v: string) => void;
  onStep: (dir: 1 | -1) => void;
  cutoffExample?: string;
  isFirst?: boolean;
}) {
  return (
    <div className="set-row" style={isFirst ? { borderTop: 0 } : undefined}>
      <div className="set-row__text">
        <label htmlFor={`set-${field.key}`}>{field.label}</label>
        {field.hint && (
          <span>
            {field.hint}
            {cutoffExample ? (
              <>
                {" "}
                <span className="tabular-nums">{cutoffExample}</span>
              </>
            ) : null}
          </span>
        )}
        {field.codeTag && <code>{field.codeTag}</code>}
      </div>
      <div className="stepper">
        <button
          type="button"
          aria-label={`${field.label}: weniger`}
          onClick={() => onStep(-1)}
        >
          −
        </button>
        <input
          id={`set-${field.key}`}
          name={field.key}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          onBlur={(e) => {
            // Clamp on blur so a typed value stays in range.
            const n = Number(e.target.value) || 0;
            onChange(String(Math.max(0, Math.min(field.max, n))));
          }}
        />
        <button
          type="button"
          aria-label={`${field.label}: mehr`}
          onClick={() => onStep(1)}
        >
          +
        </button>
        <span className="stepper__unit">{field.unit}</span>
      </div>
    </div>
  );
}

function formatHhmm(hour: number): string {
  const h = Math.max(0, Math.min(23, Math.round(hour)));
  return `${h < 10 ? "0" : ""}${h}:00`;
}
