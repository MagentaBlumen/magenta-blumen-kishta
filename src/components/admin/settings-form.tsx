"use client";

import { useMemo, useState, useTransition } from "react";
import { updateSettings } from "@/app/(admin)/admin/einstellungen/actions";

export type StepperField = {
  key: string;
  label: string;
  hint?: string;
  unit: string;
  step: number;
  max: number;
  showCutoffExample?: boolean;
  codeTag?: string;
};

type Group = {
  title: string;
  description?: string;
  fields: StepperField[];
};

export function SettingsForm({
  priceFields,
  timeFields,
  developerFields,
  initialValues,
  moreChildren,
  extraHidden,
}: {
  priceFields: StepperField[];
  timeFields: StepperField[];
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

  const priceGroup: Group = {
    title: "Lieferung & Preise",
    fields: priceFields,
  };
  const timeGroup: Group = { title: "Bestellzeiten", fields: timeFields };

  return (
    <form
      action={onSubmit}
      id="settings"
      noValidate
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <GroupSection group={priceGroup} values={values} onSet={set} onBump={bump} />
      <GroupSection
        group={timeGroup}
        values={values}
        onSet={set}
        onBump={bump}
        cutoffExample={cutoffExample}
      />

      <button
        type="button"
        className="btn-link more-toggle"
        aria-expanded={moreOpen}
        aria-controls="more"
        onClick={() => setMoreOpen((o) => !o)}
      >
        {moreOpen
          ? "Systemstatus und Technisches ausblenden"
          : "Systemstatus und Technisches anzeigen"}
      </button>

      <div className="more" id="more" hidden={!moreOpen}>
        {moreChildren}
        <section className="set-group" aria-labelledby="g-dev">
          <h2 id="g-dev">Für Entwickler</h2>
          <p>
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
        </section>
      </div>

      {extraHidden &&
        Object.entries(extraHidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}

      {dirty && (
        <div className="savebar" role="region" aria-label="Speichern">
          <span>Nicht gespeichert</span>
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
          Gespeichert.
        </p>
      )}
    </form>
  );
}

function GroupSection({
  group,
  values,
  onSet,
  onBump,
  cutoffExample,
}: {
  group: Group;
  values: Record<string, string>;
  onSet: (k: string, v: string) => void;
  onBump: (f: StepperField, dir: 1 | -1) => void;
  cutoffExample?: string;
}) {
  return (
    <section className="set-group" aria-label={group.title}>
      <h2>{group.title}</h2>
      {group.fields.map((f) => (
        <SettingRow
          key={f.key}
          field={f}
          value={values[f.key] ?? ""}
          onChange={(v) => onSet(f.key, v)}
          onStep={(dir) => onBump(f, dir)}
          cutoffExample={f.showCutoffExample ? cutoffExample : undefined}
        />
      ))}
    </section>
  );
}

function SettingRow({
  field,
  value,
  onChange,
  onStep,
  cutoffExample,
}: {
  field: StepperField;
  value: string;
  onChange: (v: string) => void;
  onStep: (dir: 1 | -1) => void;
  cutoffExample?: string;
}) {
  return (
    <div className="set-row">
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
